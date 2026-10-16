import type { FastifyInstance } from 'fastify';

import { createCookRequestSchema, type CreateCookResponse } from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { findPublishedDish } from '../db/content.ts';
import { recordCook } from '../db/cooks.ts';
import { ApiHttpError } from '../http/errors.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/** Prefix of the API `photoPath` (`cooks/{user_id}/{uuid}.jpg`); `cooks.photo_path` is stored without it. */
const COOKS_FOLDER = 'cooks/';

/**
 * `POST /cooks`: the dish is cooked. Checks the access (`has_access`) and the daily limit again on
 * the server; a photo is accepted only from the user's own folder.
 */
export function cookRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.post('/api/cooks', async (request, reply): Promise<CreateCookResponse> => {
    const body = parseOr400(createCookRequestSchema, request.body, 'Invalid cook');
    const user = requireUser(request);
    const photoPath = body.photoPath ?? null;
    if (photoPath !== null && !photoPath.startsWith(`${COOKS_FOLDER}${user.id}/`))
      throw new ApiHttpError(400, 'validation', 'Unknown photo');
    const dish = await findPublishedDish(deps.db, body.dishId);
    if (!dish) throw new ApiHttpError(404, 'not_found', 'Dish not found');

    const result = await recordCook(
      deps.db,
      user.id,
      dish,
      photoPath === null ? null : photoPath.slice(COOKS_FOLDER.length),
      deps.now(),
    );
    switch (result.kind) {
      case 'paywall':
        throw new ApiHttpError(403, 'paywall', 'Subscription required');
      case 'rateLimited':
        throw new ApiHttpError(429, 'rate_limited', 'Too many cooks today');
      case 'ok':
        reply.code(201);
        return result.result;
    }
  });
}
