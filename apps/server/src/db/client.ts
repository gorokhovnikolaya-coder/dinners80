import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.ts';

export type Db = NodePgDatabase<typeof schema>;

/**
 * `DATABASE_URL` from the environment: the password lives only there and in `.env` (the npm
 * scripts load `.env` of the repository root; the local value is in `.env.example`).
 */
export function databaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const url = env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set: copy .env.example to .env (local Postgres of docker-compose) or set it in the environment',
    );
  }
  return url;
}

export interface Database {
  db: Db;
  pool: pg.Pool;
}

export function connect(url: string = databaseUrl()): Database {
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}
