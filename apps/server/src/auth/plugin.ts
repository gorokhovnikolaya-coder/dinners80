import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { Db } from '../db/client.ts';
import { findUserByTgId, type UserRow } from '../db/users.ts';
import { ApiHttpError } from '../http/errors.ts';
import { validateAuthorization, type InitData } from './initData.ts';

/**
 * How a route is authenticated (route option `config.auth`):
 * - `user` (default) — valid init data of a user that exists in the database (`POST /auth` creates it);
 * - `initData` — valid init data only (`POST /auth` itself);
 * - `public` — no `Authorization` (health check, the bot webhook with its own secret).
 */
export type AuthMode = 'user' | 'initData' | 'public';

declare module 'fastify' {
  interface FastifyContextConfig {
    auth?: AuthMode;
  }
  interface FastifyRequest {
    /** Checked init data; set for `user` and `initData` routes. */
    initData: InitData | null;
    /** The current user; set for `user` routes. */
    user: UserRow | null;
  }
}

export interface AuthOptions {
  db: Db;
  botToken: string;
  now: () => Date;
}

const unauthorized = (message: string) => new ApiHttpError(401, 'unauthorized', message);

/**
 * Checks `Authorization: tma <initData>` for every route (deny by default): one `onRequest` hook
 * of the app, so a new endpoint cannot skip it. Must be registered before the routes.
 */
export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  app.decorateRequest('initData', null);
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request) => {
    if (request.is404) return;
    const mode = request.routeOptions.config.auth ?? 'user';
    if (mode === 'public') return;

    const result = validateAuthorization(
      request.headers.authorization,
      options.botToken,
      options.now(),
    );
    if (!result.ok) throw unauthorized(`Invalid initData: ${result.reason}`);
    request.initData = result.data;
    if (mode === 'initData') return;

    const user = await findUserByTgId(options.db, result.data.user.tgId);
    if (!user) throw unauthorized('Unknown user: call POST /auth first');
    request.user = user;
  });
}

/** Init data of an authenticated request (routes with `auth: 'initData'` or `'user'`). */
export function requireInitData(request: FastifyRequest): InitData {
  if (!request.initData) throw unauthorized('Missing initData');
  return request.initData;
}

/** The current user of a `user` route. */
export function requireUser(request: FastifyRequest): UserRow {
  if (!request.user) throw unauthorized('Missing user');
  return request.user;
}
