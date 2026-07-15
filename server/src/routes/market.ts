import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  ACCESSORIES, MARKET_BUNDLES, MARKET_BUNDLES_BY_ID, customCharacterId,
} from '@shared/index';
import { requireAuth } from '../auth';
import { query } from '../db';
import { config } from '../env';
import { normalizeDrawingDataUrl } from '../imageProcessing';
import { hasDisallowedPublicContent } from '../moderation';

export const marketRouter = Router();

type DrawingRequestType = 'pro-player' | 'photo-player';

interface CheckoutSessionResponse {
  id: string;
  url?: string;
}

interface ParsedCheckoutReference {
  purchaseKind?: 'bundle' | 'drawing_request';
  userId?: string;
  bundleId?: string;
  requestId?: string;
  requestType?: DrawingRequestType;
}

const drawingRequestSchema = z.object({
  type: z.enum(['pro-player', 'photo-player']),
  subject: z.string().trim().min(2, 'Add a name for the request.').max(80, 'Keep the name under 80 characters.'),
  photoDataUrl: z.string().max(5_500_000, 'Photo is too large.').optional(),
});

const PHOTO_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

const DEFAULT_STRIPE_PAYMENT_LINKS = {
  goldenStateBundle: 'https://buy.stripe.com/8x27sLdsa9QZ5QQgOqf7i00',
  proPlayerRequest: 'https://buy.stripe.com/9B6aEXafY0gp3IIeGif7i01',
  photoDrawingRequest: 'https://buy.stripe.com/14A8wP1Js3sBgvu69Mf7i02',
};

type StripePaymentLinkKey = keyof typeof DEFAULT_STRIPE_PAYMENT_LINKS;

function stripePaymentLink(key: StripePaymentLinkKey): string {
  const runtimeConfig = config as typeof config & {
    stripePaymentLinks?: Partial<Record<StripePaymentLinkKey, string>>;
  };
  return runtimeConfig.stripePaymentLinks?.[key] || DEFAULT_STRIPE_PAYMENT_LINKS[key];
}

const adminStatusSchema = z.object({
  status: z.enum(['paid', 'in_review', 'in_progress', 'rejected']),
  adminNote: z.string().trim().max(600).optional(),
});

const adminFulfillSchema = z.object({
  finalName: z.string().trim().min(2).max(40),
  finalDrawingDataUrl: z.string().max(5_500_000),
  visibility: z.enum(['public', 'private']),
  minOverall: z.number().int().min(0).max(99),
  maxOverall: z.number().int().min(0).max(99),
  buildHint: z.string().trim().max(180).optional(),
  adminNote: z.string().trim().max(600).optional(),
}).refine(data => data.minOverall <= data.maxOverall, {
  message: 'Minimum overall must be lower than maximum overall.',
  path: ['minOverall'],
});

interface DrawingRequestRow {
  id: string;
  user_id: string;
  username: string;
  request_type: string;
  subject: string;
  photo_data_url: string;
  price_cents: number;
  stripe_session_id: string;
  status: string;
  paid_at: string | null;
  admin_note: string;
  final_name: string;
  final_drawing_data_url: string;
  visibility: 'public' | 'private';
  min_overall: number;
  max_overall: number;
  build_hint: string;
  admin_hidden: boolean;
  fulfilled_at: string | null;
  created_at: string;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!config.adminSecret) {
    res.status(503).json({ error: 'Admin tools are not configured.' });
    return false;
  }
  const supplied = req.get('x-admin-secret') || '';
  if (supplied !== config.adminSecret) {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

function requestStatusLabel(status: string): string {
  if (status === 'paid') return 'In review';
  if (status === 'in_review') return 'In review';
  if (status === 'in_progress') return 'Drawing in progress';
  if (status === 'fulfilled') return 'Ready';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending_checkout') return 'Payment processing';
  return status.replace(/_/g, ' ');
}

function mapDrawingRequest(row: DrawingRequestRow, includePhoto = false) {
  const completed = row.status === 'fulfilled' && Boolean(row.final_drawing_data_url);
  return {
    id: row.id,
    characterId: customCharacterId(row.id),
    userId: row.user_id,
    username: row.username,
    type: row.request_type,
    subject: row.subject,
    photoDataUrl: includePhoto ? row.photo_data_url : '',
    hasPhoto: Boolean(row.photo_data_url),
    priceCents: row.price_cents,
    stripeSessionId: row.stripe_session_id,
    status: row.status,
    statusLabel: completed ? 'Published' : requestStatusLabel(row.status),
    paidAt: row.paid_at,
    adminNote: row.admin_note,
    finalName: row.final_name,
    finalDrawingSrc: completed ? `/api/market/drawings/${encodeURIComponent(row.id)}/image` : '',
    visibility: row.visibility,
    minOverall: row.min_overall,
    maxOverall: row.max_overall,
    buildHint: row.build_hint,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
  };
}

function priceForDrawingRequest(type: DrawingRequestType): number {
  return type === 'pro-player' ? 500 : 1000;
}

function stripePriceForDrawingRequest(type: DrawingRequestType): string {
  return type === 'pro-player'
    ? config.stripePrices.proPlayerRequest
    : config.stripePrices.photoDrawingRequest;
}

function paymentLinkForDrawingRequest(type: DrawingRequestType): string {
  return type === 'pro-player'
    ? stripePaymentLink('proPlayerRequest')
    : stripePaymentLink('photoDrawingRequest');
}

function checkoutReferenceForBundle(userId: string, bundleId: string): string {
  return `bab_bundle:${userId}:${bundleId}`;
}

function checkoutReferenceForDrawingRequest(userId: string, requestId: string, type: DrawingRequestType): string {
  return `bab_request:${userId}:${requestId}:${type}`;
}

function parseCheckoutReference(reference = ''): ParsedCheckoutReference {
  const [kind, userId, objectId, requestType] = reference.split(':');
  if (kind === 'bab_bundle' && userId && objectId) {
    return { purchaseKind: 'bundle', userId, bundleId: objectId };
  }
  if (
    kind === 'bab_request'
    && userId
    && objectId
    && (requestType === 'pro-player' || requestType === 'photo-player')
  ) {
    return {
      purchaseKind: 'drawing_request',
      userId,
      requestId: objectId,
      requestType,
    };
  }
  return {};
}

function checkoutUrlForPaymentLink(paymentLink: string, clientReferenceId: string): string {
  const url = new URL(paymentLink);
  url.searchParams.set('client_reference_id', clientReferenceId);
  return url.toString();
}

function checkoutBaseUrl(req: Request): string {
  return req.get('origin') || config.clientOrigin;
}

async function createCheckoutSession(params: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSessionResponse> {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);
  body.set('client_reference_id', params.userId);
  body.set('line_items[0][price]', params.priceId);
  body.set('line_items[0][quantity]', '1');
  for (const [key, value] of Object.entries({ userId: params.userId, ...params.metadata })) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json().catch(() => null) as CheckoutSessionResponse & { error?: { message?: string } } | null;
  if (!response.ok || !data?.url) {
    throw new Error(data?.error?.message || 'Could not start checkout.');
  }
  return data;
}

function verifyStripeSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map(part => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const digest = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const digestBuffer = Buffer.from(digest, 'hex');
  return expectedBuffer.length === digestBuffer.length && timingSafeEqual(expectedBuffer, digestBuffer);
}

async function fulfillCheckoutSession(session: {
  id: string;
  payment_status?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  if (session.payment_status && session.payment_status !== 'paid') return;
  const metadata = session.metadata ?? {};
  const reference = parseCheckoutReference(session.client_reference_id);
  const purchaseKind = metadata.purchaseKind || reference.purchaseKind;
  const userId = metadata.userId || reference.userId;
  const bundleId = metadata.bundleId || reference.bundleId;
  const requestId = metadata.requestId || reference.requestId;
  if (purchaseKind === 'bundle' && userId && bundleId) {
    await query(
      `INSERT INTO user_bundles (user_id, bundle_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, bundle_id) DO NOTHING`,
      [userId, bundleId],
    );
    return;
  }
  if (purchaseKind === 'drawing_request' && userId && requestId) {
    await query(
      `UPDATE market_drawing_requests
       SET status = 'paid', stripe_session_id = $1, paid_at = now()
       WHERE id = $2 AND user_id = $3`,
      [session.id, requestId, userId],
    );
  }
}

async function ownedBundleIds(userId: string): Promise<string[]> {
  const result = await query<{ bundle_id: string }>(
    'SELECT bundle_id FROM user_bundles WHERE user_id = $1 ORDER BY purchased_at ASC',
    [userId],
  );
  return result.rows.map(row => row.bundle_id);
}

marketRouter.get('/bundles', async (req, res, next) => {
  try {
    const ownedBundleIdList = req.user ? await ownedBundleIds(req.user.id) : [];
    res.json({
      bundles: MARKET_BUNDLES,
      ownedBundleIds: ownedBundleIdList,
    });
  } catch (err) { next(err); }
});

marketRouter.post('/bundles/:id/purchase', requireAuth, async (req, res, next) => {
  try {
    const bundle = MARKET_BUNDLES_BY_ID[req.params.id];
    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }

    const bundlePaymentLink = stripePaymentLink('goldenStateBundle');
    if (bundlePaymentLink) {
      res.json({
        bundle,
        ownedBundleIds: await ownedBundleIds(req.user!.id),
        checkoutUrl: checkoutUrlForPaymentLink(
          bundlePaymentLink,
          checkoutReferenceForBundle(req.user!.id, bundle.id),
        ),
      });
      return;
    }

    if (config.stripeSecretKey) {
      const baseUrl = checkoutBaseUrl(req);
      const session = await createCheckoutSession({
        priceId: config.stripePrices.goldenStateBundle,
        successUrl: `${baseUrl}/market?checkout=bundle-success`,
        cancelUrl: `${baseUrl}/market?checkout=cancelled`,
        userId: req.user!.id,
        metadata: {
          purchaseKind: 'bundle',
          bundleId: bundle.id,
        },
      });
      res.json({ bundle, ownedBundleIds: await ownedBundleIds(req.user!.id), checkoutUrl: session.url });
      return;
    }

    await query(
      `INSERT INTO user_bundles (user_id, bundle_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, bundle_id) DO NOTHING`,
      [req.user!.id, bundle.id],
    );

    res.json({
      bundle,
      ownedBundleIds: await ownedBundleIds(req.user!.id),
    });
  } catch (err) { next(err); }
});

marketRouter.get('/accessories', requireAuth, async (req, res, next) => {
  try {
    const owned = await ownedBundleIds(req.user!.id);
    const ownedSet = new Set(owned);
    res.json({
      accessories: ACCESSORIES,
      ownedBundleIds: owned,
      ownedAccessoryIds: ACCESSORIES
        .filter(accessory => ownedSet.has(accessory.bundleId))
        .map(accessory => accessory.id),
    });
  } catch (err) { next(err); }
});

marketRouter.get('/drawing-requests', requireAuth, async (req, res, next) => {
  try {
    const result = await query<DrawingRequestRow>(
      `SELECT r.*, u.username
       FROM market_drawing_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = $1 AND r.status <> 'pending_payment'
       ORDER BY created_at DESC`,
      [req.user!.id],
    );
    res.json({
      requests: result.rows.map(row => mapDrawingRequest(row)),
    });
  } catch (err) { next(err); }
});

marketRouter.delete('/drawing-requests/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query<Pick<DrawingRequestRow, 'id' | 'status'>>(
      `SELECT id, status
       FROM market_drawing_requests
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id],
    );
    const request = result.rows[0];
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    if (request.status !== 'rejected') {
      res.status(400).json({ error: 'Only rejected drawing requests can be deleted.' });
      return;
    }
    await query(
      `DELETE FROM market_drawing_requests
       WHERE id = $1 AND user_id = $2 AND status = 'rejected'`,
      [req.params.id, req.user!.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

marketRouter.get('/drawings/:id/image', async (req, res, next) => {
  try {
    const result = await query<{
      final_drawing_data_url: string;
    }>(
      `SELECT final_drawing_data_url
       FROM market_drawing_requests
       WHERE id = $1 AND status = 'fulfilled' AND final_drawing_data_url <> ''`,
      [req.params.id],
    );
    const dataUrl = result.rows[0]?.final_drawing_data_url;
    if (!dataUrl || !PHOTO_DATA_URL_RE.test(dataUrl)) {
      res.status(404).json({ error: 'Drawing not found' });
      return;
    }
    const normalized = await normalizeDrawingDataUrl(dataUrl);
    if (normalized.dataUrl !== dataUrl) {
      await query(
        `UPDATE market_drawing_requests
         SET final_drawing_data_url = $1
         WHERE id = $2 AND final_drawing_data_url = $3`,
        [normalized.dataUrl, req.params.id, dataUrl],
      );
    }
    res.setHeader('Content-Type', normalized.mime);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.end(normalized.buffer);
  } catch (err) { next(err); }
});

marketRouter.get('/admin/drawing-requests', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const result = await query<DrawingRequestRow>(
      `SELECT r.*, u.username
       FROM market_drawing_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.status <> 'pending_payment'
         AND r.admin_hidden = FALSE
       ORDER BY
         CASE r.status
           WHEN 'paid' THEN 0
           WHEN 'in_review' THEN 1
           WHEN 'in_progress' THEN 2
           WHEN 'pending_checkout' THEN 3
           WHEN 'fulfilled' THEN 4
           WHEN 'rejected' THEN 5
           ELSE 6
         END,
         r.created_at DESC
       LIMIT 200`,
    );
    res.json({ requests: result.rows.map(row => mapDrawingRequest(row, true)) });
  } catch (err) { next(err); }
});

marketRouter.patch('/admin/drawing-requests/:id/status', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { status, adminNote = '' } = adminStatusSchema.parse(req.body);
    const result = await query<DrawingRequestRow>(
      `UPDATE market_drawing_requests r
       SET status = $1, admin_note = $2
       FROM users u
       WHERE r.id = $3 AND u.id = r.user_id AND r.status <> 'pending_payment'
       RETURNING r.*, u.username`,
      [status, adminNote, req.params.id],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    res.json({ request: mapDrawingRequest(row, true) });
  } catch (err) { next(err); }
});

marketRouter.post('/admin/drawing-requests/:id/fulfill', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const data = adminFulfillSchema.parse(req.body);
    if (!PHOTO_DATA_URL_RE.test(data.finalDrawingDataUrl)) {
      res.status(400).json({ error: 'Upload a PNG, JPG, or WEBP drawing.' });
      return;
    }
    let normalizedDrawing;
    try {
      normalizedDrawing = await normalizeDrawingDataUrl(data.finalDrawingDataUrl);
    } catch {
      res.status(400).json({ error: 'The drawing could not be read. Upload a valid PNG, JPG, or WEBP image.' });
      return;
    }
    const result = await query<DrawingRequestRow>(
      `UPDATE market_drawing_requests r
       SET status = 'fulfilled',
           final_name = $1,
           final_drawing_data_url = $2,
           visibility = $3,
           min_overall = $4,
           max_overall = $5,
           build_hint = $6,
           admin_note = $7,
           fulfilled_at = now()
       FROM users u
       WHERE r.id = $8 AND u.id = r.user_id AND r.status <> 'pending_payment'
       RETURNING r.*, u.username`,
      [
        data.finalName,
        normalizedDrawing.dataUrl,
        data.visibility,
        data.minOverall,
        data.maxOverall,
        data.buildHint ?? '',
        data.adminNote ?? '',
        req.params.id,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    res.json({ request: mapDrawingRequest(row, true) });
  } catch (err) { next(err); }
});

marketRouter.delete('/admin/drawing-requests/:id', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const existing = await query<{ status: string }>(
      `SELECT status
       FROM market_drawing_requests
       WHERE id = $1 AND status <> 'pending_payment'`,
      [req.params.id],
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    if (row.status !== 'rejected') {
      res.status(400).json({ error: 'Only rejected drawing requests can be deleted.' });
      return;
    }
    await query(
      `UPDATE market_drawing_requests
       SET admin_hidden = TRUE
       WHERE id = $1 AND status = 'rejected'`,
      [req.params.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

marketRouter.post('/drawing-requests', requireAuth, async (req, res, next) => {
  try {
    const { type, subject, photoDataUrl = '' } = drawingRequestSchema.parse(req.body) as {
      type: DrawingRequestType;
      subject: string;
      photoDataUrl?: string;
    };
    if (hasDisallowedPublicContent(subject)) {
      res.status(400).json({ error: 'That request contains language that is not allowed.' });
      return;
    }
    if (type === 'photo-player' && !PHOTO_DATA_URL_RE.test(photoDataUrl)) {
      res.status(400).json({ error: 'Upload a PNG, JPG, or WEBP photo.' });
      return;
    }
    if (type === 'pro-player' && photoDataUrl) {
      res.status(400).json({ error: 'Photo uploads are only for custom photo requests.' });
      return;
    }

    const id = randomUUID();
    const priceCents = priceForDrawingRequest(type);
    await query(
      `INSERT INTO market_drawing_requests
       (id, user_id, request_type, subject, photo_data_url, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user!.id, type, subject, photoDataUrl, priceCents],
    );

    const paymentLink = paymentLinkForDrawingRequest(type);
    if (paymentLink) {
      const clientReferenceId = checkoutReferenceForDrawingRequest(req.user!.id, id, type);
      await query(
        `UPDATE market_drawing_requests
         SET stripe_session_id = $1, status = 'pending_checkout'
         WHERE id = $2`,
        [clientReferenceId, id],
      );
      res.status(201).json({
        request: { id, type, subject, priceCents, status: 'pending_checkout' },
        checkoutUrl: checkoutUrlForPaymentLink(paymentLink, clientReferenceId),
      });
      return;
    }

    if (config.stripeSecretKey) {
      const baseUrl = checkoutBaseUrl(req);
      const session = await createCheckoutSession({
        priceId: stripePriceForDrawingRequest(type),
        successUrl: `${baseUrl}/market?checkout=drawing-success`,
        cancelUrl: `${baseUrl}/market?checkout=cancelled`,
        userId: req.user!.id,
        metadata: {
          purchaseKind: 'drawing_request',
          requestId: id,
          requestType: type,
        },
      });
      await query(
        `UPDATE market_drawing_requests
         SET stripe_session_id = $1, status = 'pending_checkout'
         WHERE id = $2`,
        [session.id, id],
      );
      res.status(201).json({
        request: { id, type, subject, priceCents, status: 'pending_checkout' },
        checkoutUrl: session.url,
      });
      return;
    }

    res.status(201).json({ request: { id, type, subject, priceCents, status: 'pending_payment' } });
  } catch (err) { next(err); }
});

export const stripeWebhookHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!config.stripeWebhookSecret) {
      res.status(500).json({ error: 'Stripe webhook secret is not configured.' });
      return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = req.get('stripe-signature') || '';
    if (!verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret)) {
      res.status(400).json({ error: 'Invalid Stripe signature.' });
      return;
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: { object?: unknown };
    };
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object as Parameters<typeof fulfillCheckoutSession>[0] | undefined;
      if (session?.id) {
        await fulfillCheckoutSession(session);
      }
    }
    res.json({ received: true });
  } catch (err) { next(err); }
};
