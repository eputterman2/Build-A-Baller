import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../env';
import { query } from '../db';

export const feedbackRouter = Router();

const FEEDBACK_TO = 'baballersupport@gmail.com';
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

async function sendFeedbackEmail(message: string, username: string): Promise<'sent' | 'not_configured' | 'failed'> {
  if (!config.resendApiKey) return 'not_configured';

  const text = [
    'New Build-A-Baller feedback',
    username ? `User: ${username}` : 'User: Anonymous',
    '',
    message,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.feedbackFrom,
        to: FEEDBACK_TO,
        subject: 'Build-A-Baller feedback',
        text,
      }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

feedbackRouter.post('/', async (req, res, next) => {
  try {
    const { message } = feedbackSchema.parse(req.body);
    const id = randomUUID();
    const username = req.user?.username ?? '';
    const emailStatus = await sendFeedbackEmail(message, username);

    await query(
      `INSERT INTO feedback_messages (id, user_id, username, message, word_count, email_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.user?.id ?? null, username, message, countWords(message), emailStatus],
    );

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});
