import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerAuth } from './auth/plugin.ts';
import type { Db } from './db/client.ts';
import { registerErrorHandlers } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { cookRoutes } from './routes/cooks.ts';
import type { RouteDeps } from './routes/deps.ts';
import { dishRoutes } from './routes/dishes.ts';
import { friendsRoutes } from './routes/friends.ts';
import { healthRoutes } from './routes/health.ts';
import { homeRoutes } from './routes/home.ts';
import { meRoutes } from './routes/me.ts';
import { shoppingRoutes } from './routes/shopping.ts';

export interface AppDeps {
  db: Db;
  /** Token of the bot: init data is signed with it. */
  botToken: string;
  /** Public base URL of media files (`MEDIA_URL`); `/media` by default. */
  mediaUrl?: string;
  /** Current time; injected in tests. */
  now?: () => Date;
}

export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);
  const now = deps.now ?? (() => new Date());
  const routeDeps: RouteDeps = { db: deps.db, now, mediaUrl: deps.mediaUrl ?? '/media' };
  registerErrorHandlers(app);
  // The auth hook goes first: every route below is authenticated unless it opts out.
  registerAuth(app, { db: deps.db, botToken: deps.botToken, now });
  healthRoutes(app);
  authRoutes(app, { db: deps.db, now });
  meRoutes(app, routeDeps);
  homeRoutes(app, routeDeps);
  dishRoutes(app, routeDeps);
  cookRoutes(app, routeDeps);
  friendsRoutes(app, routeDeps);
  shoppingRoutes(app, routeDeps);
  return app;
}
