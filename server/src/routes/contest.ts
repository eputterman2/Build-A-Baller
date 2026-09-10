import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { z } from 'zod';
import { type ContestEntry, type ContestState } from '@shared/index';
import { getPool, query } from '../db';
import { requireAuth } from '../auth';

export const contestRouter = Router();

const WEEKLY_VOTE_LIMIT = 30;
const POPULAR_LIMIT = 28;
const ALL_SUBMISSIONS_LIMIT = 80;
const CONTEST_CARD_WIDTH = 320;
const CONTEST_CARD_HEIGHT = 448;
const CONTEST_CARD_BG = '#fffefb';
const CONTEST_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

const submitEntrySchema = z.object({
  drawingDataUrl: z.string().max(5_500_000, 'Drawing is too large.'),
});

const voteSchema = z.object({
  entryId: z.string().min(1),
});

const impressionsSchema = z.object({
  entryIds: z.array(z.string().min(1)).max(28),
  viewerId: z.string().trim().min(8).max(120).optional(),
});

interface ContestEntryRow {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
  votes: string;
  rank: string;
  total_impressions: string;
  viewer_impressions: string;
  viewer_has_voted: boolean;
}

interface ContestExampleRow {
  id: string;
  user_id: string;
  username: string;
  updated_at: string;
}

async function weeklyVoteLimit(userId: string | null): Promise<number> {
  return WEEKLY_VOTE_LIMIT;
}

function viewerKey(req: Express.Request, viewerId?: string | null): string | null {
  if (req.user) return `user:${req.user.id}`;
  const safeViewerId = viewerId?.trim();
  return safeViewerId ? `anon:${safeViewerId}` : null;
}

function imageSrc(entryId: string): string {
  return `/api/contest/entries/${encodeURIComponent(entryId)}/image`;
}

function mapContestEntry(row: ContestEntryRow, viewerUserId: string | null): ContestEntry {
  const rank = Number(row.rank);
  return {
    id: row.id,
    title: row.user_id === viewerUserId ? 'Your Entry' : `${row.username}'s Entry`,
    artist: row.user_id === viewerUserId ? 'You' : row.username,
    votes: Number(row.votes),
    src: imageSrc(row.id),
    submittedAt: row.created_at,
    rank: Number.isFinite(rank) && rank <= POPULAR_LIMIT ? rank : null,
    isOwnEntry: row.user_id === viewerUserId,
    viewerHasVoted: Boolean(row.viewer_has_voted),
  };
}

function mapContestExampleEntry(row: ContestExampleRow, viewerUserId: string | null): ContestEntry {
  return {
    id: row.id,
    title: row.user_id === viewerUserId ? 'Your Entry' : `${row.username}'s Entry`,
    artist: row.user_id === viewerUserId ? 'You' : row.username,
    votes: 0,
    src: imageSrc(row.id),
    submittedAt: row.updated_at,
    rank: null,
    isOwnEntry: row.user_id === viewerUserId,
    viewerHasVoted: false,
  };
}

function seededUnit(seed: string): number {
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function fairSubmissionScore(row: ContestEntryRow, key: string): number {
  const totalImpressions = Number(row.total_impressions);
  const viewerImpressions = Number(row.viewer_impressions);
  const submittedAt = new Date(row.created_at).getTime();
  const ageHours = Number.isFinite(submittedAt) ? (Date.now() - submittedAt) / 3_600_000 : 999;
  const dailySeed = new Date().toISOString().slice(0, 10);
  const unseenBoost = viewerImpressions === 0 ? 1_000_000 : 0;
  const lowImpressionBoost = 100_000 / (1 + Math.max(0, totalImpressions));
  const newEntryBoost = ageHours < 48 ? 7_500 : 0;
  const stableRandom = seededUnit(`${dailySeed}:${key}:${row.id}`) * 1_000;
  return unseenBoost + lowImpressionBoost + newEntryBoost + stableRandom;
}

async function normalizeContestCardDataUrl(dataUrl: string): Promise<string> {
  if (!CONTEST_DATA_URL_RE.test(dataUrl)) {
    throw new Error('Upload a PNG, JPG, or WEBP drawing.');
  }

  const commaIndex = dataUrl.indexOf(',');
  const input = Buffer.from(dataUrl.slice(commaIndex + 1), 'base64');
  if (!input.length) throw new Error('Drawing is empty.');

  const source = sharp(input, {
    failOn: 'error',
    limitInputPixels: 40_000_000,
  });
  const metadata = await source.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) {
    throw new Error('Drawing must be a PNG, JPG, or WEBP image.');
  }

  const buffer = await sharp(input, {
    failOn: 'error',
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize(CONTEST_CARD_WIDTH, CONTEST_CARD_HEIGHT, {
      fit: 'fill',
    })
    .flatten({ background: CONTEST_CARD_BG })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function contestRows(viewerUserId: string | null, key: string | null): Promise<ContestEntryRow[]> {
  const result = await query<ContestEntryRow>(
    `WITH vote_counts AS (
       SELECT entry_id, COUNT(*)::int AS votes
       FROM contest_votes
       GROUP BY entry_id
     ),
     impression_counts AS (
       SELECT entry_id, SUM(count)::int AS total_impressions
       FROM contest_entry_impressions
       GROUP BY entry_id
     ),
     ranked_entries AS (
       SELECT
         e.id,
         e.user_id,
         u.username,
         e.created_at,
         COALESCE(v.vote_count, 0)::text AS votes,
         COALESCE(i.total_impressions, 0)::text AS total_impressions,
         COALESCE(viewer_i.count, 0)::text AS viewer_impressions,
         CASE
           WHEN $1::text IS NULL THEN FALSE
           ELSE EXISTS (
             SELECT 1
             FROM contest_votes viewer_vote
             WHERE viewer_vote.entry_id = e.id
               AND viewer_vote.voter_user_id = $1
               AND viewer_vote.week_start = date_trunc('week', now())::date
           )
         END AS viewer_has_voted,
         RANK() OVER (
           ORDER BY COALESCE(v.vote_count, 0) DESC, e.created_at ASC
         )::text AS rank
       FROM contest_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN vote_counts v(entry_id, vote_count) ON v.entry_id = e.id
       LEFT JOIN impression_counts i ON i.entry_id = e.id
       LEFT JOIN contest_entry_impressions viewer_i
         ON viewer_i.entry_id = e.id AND viewer_i.viewer_key = $2
     )
     SELECT *
     FROM ranked_entries
     ORDER BY rank::int ASC, created_at ASC
     LIMIT 500`,
    [viewerUserId, key],
  );
  return result.rows;
}

async function contestExampleRows(): Promise<ContestExampleRow[]> {
  const result = await query<ContestExampleRow>(
    `SELECT ex.id, ex.user_id, u.username, ex.updated_at::text AS updated_at
     FROM contest_entry_examples ex
     JOIN users u ON u.id = ex.user_id
     ORDER BY ex.updated_at DESC
     LIMIT 3`,
  );
  return result.rows;
}

async function saveContestExample(client: PoolClient, userId: string, drawingDataUrl: string): Promise<void> {
  await client.query(
    `INSERT INTO contest_entry_examples (id, user_id, drawing_data_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
     SET id = EXCLUDED.id,
         drawing_data_url = EXCLUDED.drawing_data_url,
         updated_at = now()`,
    [randomUUID(), userId, drawingDataUrl],
  );
}

async function readContestState(req: Express.Request, viewerId?: string | null): Promise<ContestState> {
  const viewerUserId = req.user?.id ?? null;
  const key = viewerKey(req, viewerId) ?? 'anon:public';
  const [rows, exampleRows, votesUsedResult, voteLimit] = await Promise.all([
    contestRows(viewerUserId, key),
    contestExampleRows(),
    viewerUserId
      ? query<{ used: string }>(
          `SELECT COUNT(*)::text AS used
           FROM contest_votes
           WHERE voter_user_id = $1 AND week_start = date_trunc('week', now())::date`,
          [viewerUserId],
        )
      : Promise.resolve({ rows: [{ used: '0' }] } as { rows: { used: string }[] }),
    weeklyVoteLimit(viewerUserId),
  ]);

  const popularEntries = rows
    .filter(row => Number(row.rank) <= POPULAR_LIMIT)
    .map(row => mapContestEntry(row, viewerUserId));

  const allSubmissionEntries = [...rows]
    .sort((a, b) => fairSubmissionScore(b, key) - fairSubmissionScore(a, key))
    .slice(0, ALL_SUBMISSIONS_LIMIT)
    .map(row => mapContestEntry(row, viewerUserId));

  const myEntryRow = viewerUserId ? rows.find(row => row.user_id === viewerUserId) ?? null : null;
  const used = Number(votesUsedResult.rows[0]?.used ?? 0);

  return {
    weeklyVotesLimit: voteLimit,
    weeklyVotesLeft: viewerUserId ? Math.max(0, voteLimit - used) : voteLimit,
    myEntry: myEntryRow ? mapContestEntry(myEntryRow, viewerUserId) : null,
    exampleEntries: exampleRows.map(row => mapContestExampleEntry(row, viewerUserId)),
    popularEntries,
    allSubmissionEntries,
  };
}

contestRouter.get('/', async (req, res, next) => {
  try {
    const viewerId = typeof req.query.viewerId === 'string' ? req.query.viewerId : null;
    res.json(await readContestState(req, viewerId));
  } catch (err) { next(err); }
});

contestRouter.post('/entry', requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const data = submitEntrySchema.parse(req.body);
    let normalizedDrawing: string;
    try {
      normalizedDrawing = await normalizeContestCardDataUrl(data.drawingDataUrl);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message || 'The drawing could not be read.' });
      return;
    }

    await client.query('BEGIN');
    await saveContestExample(client, req.user!.id, normalizedDrawing);
    await client.query('DELETE FROM contest_entries WHERE user_id = $1', [req.user!.id]);
    await client.query(
      `INSERT INTO contest_entries (id, user_id, drawing_data_url)
       VALUES ($1, $2, $3)`,
      [randomUUID(), req.user!.id, normalizedDrawing],
    );
    await client.query('COMMIT');

    res.json(await readContestState(req));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

contestRouter.delete('/entry', requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ drawing_data_url: string }>(
      'SELECT drawing_data_url FROM contest_entries WHERE user_id = $1',
      [req.user!.id],
    );
    const drawingDataUrl = existing.rows[0]?.drawing_data_url;
    if (drawingDataUrl) {
      await saveContestExample(client, req.user!.id, drawingDataUrl);
    }
    await client.query('DELETE FROM contest_entries WHERE user_id = $1', [req.user!.id]);
    await client.query('COMMIT');
    res.json(await readContestState(req));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

contestRouter.post('/vote', requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const data = voteSchema.parse(req.body);
    await client.query('BEGIN');
    const week = await client.query<{ week_start: string }>(
      `SELECT date_trunc('week', now())::date::text AS week_start`,
    );
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`contest-votes:${req.user!.id}:${week.rows[0]?.week_start ?? ''}`],
    );

    const entry = await client.query<{ id: string }>(
      'SELECT id FROM contest_entries WHERE id = $1',
      [data.entryId],
    );
    if (!entry.rowCount) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Contest entry not found.' });
      return;
    }

    const voteLimit = await weeklyVoteLimit(req.user!.id);
    const used = await client.query<{ used: string }>(
      `SELECT COUNT(*)::text AS used
       FROM contest_votes
       WHERE voter_user_id = $1 AND week_start = date_trunc('week', now())::date`,
      [req.user!.id],
    );
    if (Number(used.rows[0]?.used ?? 0) >= voteLimit) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `You have used all ${voteLimit} votes for this week.` });
      return;
    }

    const inserted = await client.query(
      `INSERT INTO contest_votes (id, entry_id, voter_user_id, week_start)
       VALUES ($1, $2, $3, date_trunc('week', now())::date)
       ON CONFLICT (entry_id, voter_user_id, week_start) DO NOTHING`,
      [randomUUID(), data.entryId, req.user!.id],
    );
    if (!inserted.rowCount) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'You already voted for this card this week.' });
      return;
    }

    await client.query('COMMIT');
    res.json(await readContestState(req));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

contestRouter.post('/impressions', async (req, res, next) => {
  try {
    const data = impressionsSchema.parse(req.body);
    const key = viewerKey(req, data.viewerId);
    const entryIds = [...new Set(data.entryIds)];
    if (!key || entryIds.length === 0) {
      res.json({ ok: true });
      return;
    }

    await query(
      `INSERT INTO contest_entry_impressions (entry_id, viewer_key, count, shown_at)
       SELECT id, $2, 1, now()
       FROM contest_entries
       WHERE id = ANY($1::text[])
       ON CONFLICT (entry_id, viewer_key) DO UPDATE
       SET count = contest_entry_impressions.count + 1,
           shown_at = now()`,
      [entryIds, key],
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

contestRouter.get('/entries/:id/image', async (req, res, next) => {
  try {
    const result = await query<{ drawing_data_url: string }>(
      `SELECT drawing_data_url FROM contest_entries WHERE id = $1
       UNION ALL
       SELECT drawing_data_url FROM contest_entry_examples WHERE id = $1
       LIMIT 1`,
      [req.params.id],
    );
    const dataUrl = result.rows[0]?.drawing_data_url;
    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      res.status(404).json({ error: 'Contest entry not found.' });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.end(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  } catch (err) { next(err); }
});
