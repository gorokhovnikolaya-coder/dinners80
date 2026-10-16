import { sql } from 'drizzle-orm';

import { connect, databaseUrl } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { loadContent } from './content.ts';
import { nonLocalDatabaseReason } from './localDatabase.ts';
import { runCli, runSeed } from './seed.ts';

/**
 * `npm run db:reset`: drops every table of the local database, applies the migrations and seeds
 * `content/`. Refuses a non-local database so it can never wipe production.
 */
await runCli(async () => {
  const url = databaseUrl();
  const reason = nonLocalDatabaseReason(url);
  if (reason !== null) throw new Error(`db:reset only works on a local database: ${reason}`);
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
