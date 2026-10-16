import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { connect, type Db } from './client.ts';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Applies the SQL migrations of `apps/server/migrations` that are not applied yet. */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// `npm run db:migrate`
if (import.meta.main) {
  const { db, pool } = connect();
  try {
    await runMigrations(db);
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}
