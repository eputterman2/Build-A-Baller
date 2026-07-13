import { Router } from 'express';
import { z } from 'zod';
import type { PlayerDrawingPoll } from '@shared/index';
import { query } from '../db';

export const pollsRouter = Router();

const CURRENT_POLL = {
  id: 'new-player-drawing-2026-06-25',
  question: 'Cast your vote for next week’s player.',
  options: [
    { id: 'blake-griffin', label: 'Blake Griffin' },
    { id: 'jahlil-okafor', label: 'Jahlil Okafor' },
    { id: 'lola-bunny', label: 'Lola Bunny' },
  ],
};

const voteSchema = z.object({
  optionId: z.string(),
  voterId: z.string().min(12).max(80).optional(),
});

function voterKey(req: Express.Request, voterId?: string | null): string | null {
  if (req.user) return `user:${req.user.id}`;
  const safeVoterId = voterId?.trim();
  return safeVoterId ? `anon:${safeVoterId}` : null;
}

async function readPoll(voter: string | null): Promise<PlayerDrawingPoll> {
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
  const options = CURRENT_POLL.options.map(option => ({
    ...option,
    votes: countByOption.get(option.id) ?? 0,
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
    if (!CURRENT_POLL.options.some(option => option.id === optionId)) {
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
