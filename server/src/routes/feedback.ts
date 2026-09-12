import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';

export const feedbackRouter = Router();

const MAX_FEEDBACK_WORDS = 300;

const feedbackSchema = z.object({
  message: z.string().trim().min(1, 'Feedback cannot be empty.').refine(
    value => countWords(value) <= MAX_FEEDBACK_WORDS,
    `Feedback must be ${MAX_FEEDBACK_WORDS} words or fewer.`,
  ),
});

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

feedbackRouter.post('/', async (req, res, next) => {
  try {
    const { message } = feedbackSchema.parse(req.body);
    const id = randomUUID();
    const username = req.user?.username ?? '';

    await query(
      `INSERT INTO feedback_messages (id, user_id, username, message, word_count, email_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user?.id ?? null, username, message, countWords(message), 'stored'],
    );

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});
