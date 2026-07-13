import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  ACCESSORIES, MARKET_BUNDLES, MARKET_BUNDLES_BY_ID,
} from '@shared/index';
import { requireAuth } from '../auth';
import { query } from '../db';
import { config } from '../env';
import { hasDisallowedPublicContent } from '../moderation';

export const marketRouter = Router();

type DrawingRequestType = 'pro-player' | 'photo-player';

interface CheckoutSessionResponse {
  id: string;
  url?: string;
}

const drawingRequestSchema = z.object({
  type: z.enum(['pro-player', 'photo-player']),
  subject: z.string().trim().min(2, 'Add a name for the request.').max(80, 'Keep the name under 80 characters.'),
  photoDataUrl: z.string().max(5_500_000, 'Photo is too large.').optional(),
});

const PHOTO_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

function priceForDrawingRequest(type: DrawingRequestType): number {
  return type === 'pro-player' ? 500 : 1000;
}

function stripePriceForDrawingRequest(type: DrawingRequestType): string {
  return type === 'pro-player'
    ? config.stripePrices.proPlayerRequest
    : config.stripePrices.photoDrawingRequest;
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
  metadata?: Record<string, string>;
}): Promise<void> {
  if (session.payment_status && session.payment_status !== 'paid') return;
  const metadata = session.metadata ?? {};
  if (metadata.purchaseKind === 'bundle' && metadata.bundleId) {
    await query(
      `INSERT INTO user_bundles (user_id, bundle_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, bundle_id) DO NOTHING`,
      [metadata.userId, metadata.bundleId],
    );
    return;
  }
  if (metadata.purchaseKind === 'drawing_request' && metadata.requestId) {
    await query(
      `UPDATE market_drawing_requests
       SET status = 'paid', stripe_session_id = $1, paid_at = now()
       WHERE id = $2 AND user_id = $3`,
      [session.id, metadata.requestId, metadata.userId],
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
    const result = await query<{
      id: string;
      request_type: string;
      subject: string;
      price_cents: number;
      status: string;
      created_at: string;
    }>(
      `SELECT id, request_type, subject, price_cents, status, created_at
       FROM market_drawing_requests
       WHERE user_id = $1 AND status <> 'pending_payment'
       ORDER BY created_at DESC`,
      [req.user!.id],
    );
    res.json({
      requests: result.rows.map(row => ({
        id: row.id,
        type: row.request_type,
        subject: row.subject,
        priceCents: row.price_cents,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
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
