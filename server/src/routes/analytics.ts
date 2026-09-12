import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../env';
import { query } from '../db';

export const analyticsRouter = Router();

interface FeedbackRow {
  id: string;
  username: string;
  message: string;
  word_count: string;
  created_at: string;
}

const visitSchema = z.object({
  visitorId: z.string().trim().min(8).max(120),
  path: z.string().trim().min(1).max(240).default('/'),
});

const issueSchema = z.object({
  visitorId: z.string().trim().min(8).max(120).optional(),
  type: z.enum(['error', 'unhandled-rejection']).default('error'),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(240).default('/'),
});

function requireAdmin(req: Request, res: Response): boolean {
  if (!config.adminSecret) {
    res.status(503).json({ error: 'Admin tools are not configured.' });
    return false;
  }
  if ((req.get('x-admin-secret') || '') !== config.adminSecret) {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

analyticsRouter.post('/visit', async (req, res, next) => {
  try {
    const { visitorId, path } = visitSchema.parse(req.body);
    await query(
      `INSERT INTO site_visit_days (visitor_id, visit_date, user_id, last_path, last_seen_at)
       VALUES ($1, CURRENT_DATE, $2, $3, now())
       ON CONFLICT (visitor_id, visit_date) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, site_visit_days.user_id),
           last_path = EXCLUDED.last_path,
           last_seen_at = now()`,
      [visitorId, req.user?.id ?? null, path],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

analyticsRouter.post('/issue', async (req, res, next) => {
  try {
    const { visitorId, type, message, path } = issueSchema.parse(req.body);
    await query(
      `INSERT INTO site_issue_events (visitor_id, user_id, issue_type, message, path)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitorId ?? null, req.user?.id ?? null, type, message, path],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

analyticsRouter.get('/admin', async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [visitorCounts, accountCount, issues, feedback] = await Promise.all([
      query<{ period: string; total: string; returning: string }>(
        `SELECT period,
                COUNT(DISTINCT visitor_id)::text AS total,
                COUNT(DISTINCT visitor_id) FILTER (
                  WHERE EXISTS (
                    SELECT 1 FROM site_visit_days earlier
                    WHERE earlier.visitor_id = visits.visitor_id
                      AND earlier.visit_date < windows.start_date
                  )
                )::text AS returning
         FROM (
           SELECT 'day' AS period, CURRENT_DATE AS start_date
           UNION ALL SELECT 'week', CURRENT_DATE - 6
           UNION ALL SELECT 'month', CURRENT_DATE - 29
         ) windows
         LEFT JOIN site_visit_days visits
           ON visits.visit_date >= windows.start_date
         GROUP BY period, windows.start_date
         ORDER BY CASE period WHEN 'day' THEN 1 WHEN 'week' THEN 2 ELSE 3 END`,
      ),
      query<{ total: string }>('SELECT COUNT(*)::text AS total FROM users WHERE id <> $1', ['admin-player-drawings']),
      query<{ issue_type: string; message: string; path: string; occurrences: string; last_seen_at: string }>(
        `SELECT issue_type, message, path, COUNT(*)::text AS occurrences, MAX(created_at) AS last_seen_at
         FROM site_issue_events
         WHERE created_at >= now() - INTERVAL '7 days'
         GROUP BY issue_type, message, path
         ORDER BY COUNT(*) DESC, MAX(created_at) DESC
         LIMIT 25`,
      ),
      query<FeedbackRow>(
        `SELECT id, username, message, word_count::text, created_at
         FROM feedback_messages
         ORDER BY created_at DESC
         LIMIT 100`,
      ),
    ]);

    const byPeriod = Object.fromEntries(visitorCounts.rows.map(row => [row.period, {
      total: Number(row.total),
      returning: Number(row.returning),
    }]));
    res.json({
      visitors: {
        day: byPeriod.day ?? { total: 0, returning: 0 },
        week: byPeriod.week ?? { total: 0, returning: 0 },
        month: byPeriod.month ?? { total: 0, returning: 0 },
      },
      totalAccounts: Number(accountCount.rows[0]?.total ?? 0),
      issues: issues.rows.map(issue => ({
        type: issue.issue_type,
        message: issue.message,
        path: issue.path,
        occurrences: Number(issue.occurrences),
        lastSeenAt: issue.last_seen_at,
      })),
      issuesWindow: 'Last 7 days',
      feedback: feedback.rows.map(item => ({
        id: item.id,
        username: item.username,
        message: item.message,
        wordCount: Number(item.word_count),
        createdAt: item.created_at,
      })),
    });
  } catch (err) { next(err); }
});
