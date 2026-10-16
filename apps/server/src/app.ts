import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerAuth } from './auth/plugin.ts';
import type { Db } from './db/client.ts';
import { registerErrorHandlers } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { healthRoutes } from './routes/health.ts';

export interface AppDeps {
  db: Db;
  /** Token of the bot: init data is signed with it. */
  botToken: string;
  /** Current time; injected in tests. */
  now?: () => Date;
}

export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);
  const now = deps.now ?? (() => new Date());
  registerErrorHandlers(app);
  // The auth hook goes first: every route below is authenticated unless it opts out.
  registerAuth(app, { db: deps.db, botToken: deps.botToken, now });
  healthRoutes(app);
  authRoutes(app, { db: deps.db, now });
  return app;
}
