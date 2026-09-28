import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { DB } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import * as schema from '../../src/db/schema';

let client: PGlite | undefined;

/**
 * A real PostgreSQL 17 running in-process (PGlite), migrated once per Jest worker
 * with the same runner and files a deploy uses, and emptied for each caller, so
 * every test starts clean without paying for a new database.
 */
export async function openTestDb(): Promise<DB> {
  if (!client) {
    client = new PGlite();
    await migrate(client);
  } else {
    await client.exec('truncate ai_calls, ai_suggestions, ai_items restart identity cascade');
  }
  return drizzle(client, { schema });
}

/** Closes the in-process database. Called once per Jest worker after its last test. */
export async function closeTestDb(): Promise<void> {
  await client?.close();
  client = undefined;
}
