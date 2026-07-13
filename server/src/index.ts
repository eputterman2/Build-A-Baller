import { join } from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './env';
import { initPool, migrate, waitForDb } from './db';
import { optionalAuth } from './auth';
import { authRouter } from './routes/auth';
import { playersRouter } from './routes/players';
import { buildsRouter } from './routes/builds';
import { pollsRouter } from './routes/polls';
import { feedbackRouter } from './routes/feedback';
import { marketRouter, stripeWebhookHandler } from './routes/market';
import { backfillBuildRankMetrics } from './rankings';

async function main(): Promise<void> {
  let dbUrl = config.databaseUrl;

  if (config.embeddedPg) {
    const { startEmbeddedPostgres } = await import('./devdb');
    dbUrl = await startEmbeddedPostgres();
    console.log('🐘 Embedded Postgres started for local dev');
  }
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required (or set EMBEDDED_PG=1 for local dev)');
  }

  initPool(dbUrl);
  await waitForDb();
  await migrate();
  await backfillBuildRankMetrics();
  console.log('✅ Database ready');

  const app = express();
  app.use(cors({ origin: config.isProd ? true : config.clientOrigin }));
  app.post('/api/market/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  app.use(express.json({ limit: '6mb' }));
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/auth', authRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/builds', buildsRouter);
  app.use('/api/polls', pollsRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/market', marketRouter);

  // In production, serve the built React app and let it handle client routing.
  if (config.clientDist) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(join(config.clientDist, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
      return;
    }
    const status = (err as { status?: number })?.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: (err as Error)?.message || 'Server error' });
  };
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`🏀 API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
