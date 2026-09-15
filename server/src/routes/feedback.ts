import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { isUsefulFeedback, summarizeFeedback } from '../feedbackSummary';

export const feedbackRouter = Router();

const MAX_FEEDBACK_WORDS = 300;
export const FEEDBACK_RETENTION_DAYS = 50;

const feedbackSchema = z.object({
  message: z.string().trim().min(1, 'Feedback cannot be empty.').refine(
    value => countWords(value) <= MAX_FEEDBACK_WORDS,
    `Feedback must be ${MAX_FEEDBACK_WORDS} words or fewer.`,
  ),
});

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export async function purgeExpiredFeedback(): Promise<number> {
  const result = await query(
    `DELETE FROM feedback_messages
     WHERE created_at < now() - ($1 * INTERVAL '1 day')`,
    [FEEDBACK_RETENTION_DAYS],
  );
  return result.rowCount ?? 0;
}

feedbackRouter.post('/', async (req, res, next) => {
  try {
    const { message } = feedbackSchema.parse(req.body);
    const id = randomUUID();
    const username = req.user?.username ?? '';

    await query(
      `INSERT INTO feedback_messages (id, user_id, username, message, summary, admin_hidden, word_count, email_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        req.user?.id ?? null,
        username,
        message,
        summarizeFeedback(message),
        !isUsefulFeedback(message),
        countWords(message),
        'stored',
      ],
    );

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});
