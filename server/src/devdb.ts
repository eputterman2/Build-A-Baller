import { existsSync } from 'node:fs';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

// Boots a real PostgreSQL instance with zero system install (binaries are
// downloaded into node_modules). Used only for local dev; production points
// DATABASE_URL at Cloud SQL instead.
export async function startEmbeddedPostgres(): Promise<string> {
  const databaseDir = join(__dirname, '..', '.pgdata');
  const user = 'baller';
  const password = 'baller';
  const port = 55432;
  const dbName = 'baller';

  const pg = new EmbeddedPostgres({
    databaseDir, user, password, port, persistent: true,
  });

  if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(dbName);
  } catch {
    // Database already exists — fine on subsequent runs.
  }

  const shutdown = async () => {
    try { await pg.stop(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return `postgresql://${user}:${password}@localhost:${port}/${dbName}`;
}
