import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema';

// Any Postgres-backed Drizzle database with our schema: node-postgres in production,
// PGlite in tests (test/support/db.ts). Services only ever see this type.
export type DB = PgDatabase<any, typeof schema>;
export const DATABASE = Symbol('DATABASE');

/** Production: a pooled connection to PostgreSQL. Run `npm run migrate` before the first start. */
export function connectPostgres(url: string): DB {
  return drizzle(new Pool({ connectionString: url, max: 10 }), { schema });
}
