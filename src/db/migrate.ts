import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATIONS_DIR = join(__dirname, '../../migrations');

/**
 * All migration files across the module folders, in global order. The numeric
 * prefix is the order; the folder only says which module owns the change.
 */
export function migrationFiles(dir = MIGRATIONS_DIR): { id: string; path: string }[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(dir, d.name)).filter((f) => f.endsWith('.sql')).map((f) => ({ id: `${d.name}/${f}`, path: join(dir, d.name, f) })))
    .sort((a, b) => a.id.split('/')[1]!.localeCompare(b.id.split('/')[1]!));
}

export interface SqlRunner {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Applies every migration not yet recorded in schema_migrations. Safe to run on every deploy. */
export async function migrate(db: SqlRunner): Promise<string[]> {
  await db.exec('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ id: string }>('select id from schema_migrations')).rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of migrationFiles()) {
    if (done.has(m.id)) continue;
    // one transaction per file, so a failed migration leaves nothing half applied
    await db.exec(`begin; ${readFileSync(m.path, 'utf8')}; insert into schema_migrations (id) values ('${m.id}'); commit;`);
    applied.push(m.id);
  }
  return applied;
}
