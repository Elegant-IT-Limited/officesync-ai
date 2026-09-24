import { PGlite } from '@electric-sql/pglite';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema';

export type DB = PgliteDatabase<typeof schema>;

let client: PGlite | undefined;

/**
 * Tests and local runs: a real PostgreSQL 17 (PGlite) with the pipeline migration
 * applied once per worker, and emptied for each caller.
 */
export async function openDb(): Promise<DB> {
  if (!client) {
    client = new PGlite();
    await client.exec(readFileSync(join(__dirname, '../../sql/0001_ai_pipeline.sql'), 'utf8'));
  } else {
    await client.exec('truncate ai_calls, ai_suggestions, ai_items restart identity cascade');
  }
  return drizzle(client, { schema });
}
