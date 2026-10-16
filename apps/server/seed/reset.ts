import { sql } from 'drizzle-orm';

import { connect, databaseUrl } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { loadContent } from './content.ts';
import { runCli, runSeed } from './seed.ts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * `npm run db:reset`: drops every table of the local database, applies the migrations and seeds
 * `content/`. Refuses a non-local database so it can never wipe production.
 */
await runCli(async () => {
  const url = databaseUrl();
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`db:reset only works on a local database, DATABASE_URL points to ${host}`);
  }
  // Validate before dropping anything: broken content leaves the database as it was.
  await loadContent();

  const { db, pool } = connect(url);
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema public cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(db);
    console.log('Database recreated, migrations applied');
    await runSeed(db);
  } finally {
    await pool.end();
  }
});
