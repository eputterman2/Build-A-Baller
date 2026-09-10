import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AdminPlayerDrawingPoll, PlayerDrawingPoll } from '@shared/index';
import { getPool, query } from '../db';
import { config } from '../env';

export const pollsRouter = Router();

const CURRENT_POLL = {
  id: 'new-player-drawing-2026-06-25',
  question: 'Cast your vote for next week’s player.',
};

const voteSchema = z.object({
  optionId: z.string(),
  voterId: z.string().min(12).max(80).optional(),
});
const adminPollOptionsSchema = z.object({
  options: z.array(z.string().trim().min(2).max(40)).length(3),
  resetVotes: z.boolean().optional().default(false),
}).refine(data => new Set(data.options.map(option => option.toLowerCase())).size === data.options.length, {
  path: ['options'],
  message: 'Use three different names.',
});

const DEFAULT_POLL_OPTIONS = [
  { slot: 1, label: 'Blake Griffin' },
  { slot: 2, label: 'Jahlil Okafor' },
  { slot: 3, label: 'Lola Bunny' },
];

interface PollOptionRow {
  slot: number;
  option_id: string;
  label: string;
}

function optionIdForLabel(label: string, slot: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'player';
  return `slot-${slot}-${slug}`;
}

async function ensurePollOptions(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS player_drawing_poll_options (
      poll_id    TEXT NOT NULL,
      slot       INTEGER NOT NULL,
      option_id  TEXT NOT NULL,
      label      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (poll_id, slot),
      UNIQUE (poll_id, option_id)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS player_drawing_poll_options_poll_idx
    ON player_drawing_poll_options (poll_id, slot)
  `);
  for (const option of DEFAULT_POLL_OPTIONS) {
    await query(
      `INSERT INTO player_drawing_poll_options (poll_id, slot, option_id, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [CURRENT_POLL.id, option.slot, optionIdForLabel(option.label, option.slot), option.label],
    );
  }
}

async function currentPollOptions(): Promise<PollOptionRow[]> {
  await ensurePollOptions();
  const result = await query<PollOptionRow>(
    `SELECT slot, option_id, label
     FROM player_drawing_poll_options
     WHERE poll_id = $1
     ORDER BY slot ASC`,
    [CURRENT_POLL.id],
  );
  return result.rows;
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

function voterKey(req: Express.Request, voterId?: string | null): string | null {
  if (req.user) return `user:${req.user.id}`;
  const safeVoterId = voterId?.trim();
  return safeVoterId ? `anon:${safeVoterId}` : null;
}

async function readPoll(voter: string | null): Promise<PlayerDrawingPoll> {
  const pollOptions = await currentPollOptions();
  const [countsResult, viewerResult] = await Promise.all([
    query<{ option_id: string; votes: string }>(
      `SELECT option_id, COUNT(*)::text AS votes
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_id`,
      [CURRENT_POLL.id],
    ),
    voter
      ? query<{ option_id: string }>(
          `SELECT option_id
           FROM poll_votes
           WHERE poll_id = $1 AND voter_key = $2`,
          [CURRENT_POLL.id, voter],
        )
      : Promise.resolve({ rows: [] } as { rows: { option_id: string }[] }),
  ]);

  const countByOption = new Map(countsResult.rows.map(row => [row.option_id, Number(row.votes)]));
  const options = pollOptions.map(option => ({
    id: option.option_id,
    label: option.label,
    votes: countByOption.get(option.option_id) ?? 0,
  }));

  return {
    id: CURRENT_POLL.id,
    question: CURRENT_POLL.question,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    viewerVoteOptionId: viewerResult.rows[0]?.option_id ?? null,
  };
}

pollsRouter.get('/current', async (req, res, next) => {
  try {
    const voter = voterKey(req, typeof req.query.voterId === 'string' ? req.query.voterId : null);
    res.json(await readPoll(voter));
  } catch (err) { next(err); }
});

pollsRouter.post('/current/vote', async (req, res, next) => {
  try {
    const { optionId, voterId } = voteSchema.parse(req.body);
    const pollOptions = await currentPollOptions();
    if (!pollOptions.some(option => option.option_id === optionId)) {
      res.status(400).json({ error: 'Unknown poll option' });
      return;
    }

    const voter = voterKey(req, voterId);
    if (!voter) {
      res.status(400).json({ error: 'Missing voter id' });
      return;
    }

    await query(
      `INSERT INTO poll_votes (poll_id, voter_key, option_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, voter_key) DO NOTHING`,
      [CURRENT_POLL.id, voter, optionId],
    );

    res.json(await readPoll(voter));
  } catch (err) { next(err); }
});

pollsRouter.get('/admin/current', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const poll = await readPoll(null);
    const adminPoll: AdminPlayerDrawingPoll = {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
    };
    res.json({ poll: adminPoll });
  } catch (err) { next(err); }
});

pollsRouter.patch('/admin/current', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { options, resetVotes } = adminPollOptionsSchema.parse(req.body);
    const currentOptions = await currentPollOptions();
    const namesChanged = options.some((label, index) => label.trim() !== currentOptions[index]?.label);
    if (namesChanged && !resetVotes) {
      res.status(409).json({ error: 'Changing these names resets the poll and clears all current votes.' });
      return;
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      for (const [index, label] of options.entries()) {
        const slot = index + 1;
        await client.query(
          `INSERT INTO player_drawing_poll_options (poll_id, slot, option_id, label, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (poll_id, slot)
           DO UPDATE SET option_id = EXCLUDED.option_id, label = EXCLUDED.label, updated_at = now()`,
          [CURRENT_POLL.id, slot, optionIdForLabel(label, slot), label],
        );
      }
      if (namesChanged && resetVotes) {
        await client.query('DELETE FROM poll_votes WHERE poll_id = $1', [CURRENT_POLL.id]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const poll = await readPoll(null);
    const adminPoll: AdminPlayerDrawingPoll = {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
    };
    res.json({ poll: adminPoll });
  } catch (err) { next(err); }
});
