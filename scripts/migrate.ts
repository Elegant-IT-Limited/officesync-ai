// Applies pending migrations to DATABASE_URL. Run once per deploy, before the app starts.
import { Pool } from 'pg';
import { migrate } from '../src/db/migrate';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const applied = await migrate({ exec: (sql) => pool.query(sql), query: (sql, params) => pool.query(sql, params) as never });
    console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
