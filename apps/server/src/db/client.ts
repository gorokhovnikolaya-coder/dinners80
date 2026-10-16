import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.ts';

export type Db = NodePgDatabase<typeof schema>;

/** The local Postgres of docker-compose.yml (dev credentials, as in .env.example). */
export const LOCAL_DATABASE_URL = 'postgres://tma80:tma80@127.0.0.1:5433/tma80';

/** `DATABASE_URL` from the environment; without it — the local dev database. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
}

export interface Database {
  db: Db;
  pool: pg.Pool;
}

export function connect(url: string = databaseUrl()): Database {
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}
