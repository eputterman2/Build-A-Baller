import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool;

export function initPool(connectionString: string): Pool {
  pool = new Pool({ connectionString, max: 10 });
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database pool not initialised');
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

// Apply the schema. Safe to run on every boot.
export async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(sql);
}

// Retry connecting — embedded/Cloud SQL may take a moment to accept connections.
export async function waitForDb(attempts = 20, delayMs = 500): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getPool().query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
