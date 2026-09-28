import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { migrate } from './migrate';
import * as schema from './schema';

export type DB = PgDatabase<any, typeof schema>;
export const DATABASE = Symbol('DATABASE');

/** Production: a pooled connection to PostgreSQL. Run `npm run migrate` before the first start. */
export function connectPostgres(url: string): DB {
  return drizzlePg(new Pool({ connectionString: url, max: 10 }), { schema });
}

let client: PGlite | undefined;

/**
 * Tests and local runs: a real PostgreSQL 17 running in-process (PGlite), migrated
 * once per Jest worker and emptied for each caller, so every test starts clean
 * without paying for a new database.
 */
export async function openLocalDb(): Promise<DB> {
  if (!client) {
    client = new PGlite();
    await migrate(client);
  } else {
    await client.exec('truncate ai_calls, ai_suggestions, ai_items restart identity cascade');
  }
  return drizzlePglite(client, { schema });
}

/** Closes the in-process database. Called once per Jest worker after its last test. */
export async function closeLocalDb(): Promise<void> {
  await client?.close();
  client = undefined;
}
