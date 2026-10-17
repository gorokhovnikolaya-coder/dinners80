import type { FastifyInstance } from 'fastify';

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod/mini';

import {
  addCookPhotoRequestSchema,
  createCookRequestSchema,
  type AddCookPhotoResponse,
  type CreateCookResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { findPublishedDish } from '../db/content.ts';
import { recordCook } from '../db/cooks.ts';
import { cooks } from '../db/schema.ts';
import { ApiHttpError } from '../http/errors.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/** Prefix of the API `photoPath` (`cooks/{user_id}/{uuid}.jpg`); `cooks.photo_path` is stored without it. */
const COOKS_FOLDER = 'cooks/';

const cookIdSchema = z.object({ id: z.uuid() });

/**
 * A photo path of the API (`cooks/{user_id}/{uuid}.jpg`) → `cooks.photo_path`: only from the
 * user's own folder and only an uploaded file, otherwise `400 validation`.
 */
async function ownPhotoPath(deps: RouteDeps, userId: string, photoPath: string): Promise<string> {
  const stored = photoPath.slice(COOKS_FOLDER.length);
  if (
    !photoPath.startsWith(`${COOKS_FOLDER}${userId}/`) ||
    !(await deps.media.cookPhotoExists(stored))
  )
    throw new ApiHttpError(400, 'validation', 'Unknown photo');
  return stored;
}

/**
 * `POST /cooks`: the dish is cooked. Checks the access (`has_access`) and the daily limit again on
 * the server; a photo is accepted only from the user's own folder and only if it was uploaded.
 * `PATCH /cooks/:id`: a photo for the user's own cook recorded without one (not used by the MVP UI).
 */
export function cookRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.post('/api/cooks', async (request, reply): Promise<CreateCookResponse> => {
    const body = parseOr400(createCookRequestSchema, request.body, 'Invalid cook');
    const user = requireUser(request);
    const photoPath =
      body.photoPath == null ? null : await ownPhotoPath(deps, user.id, body.photoPath);
    const dish = await findPublishedDish(deps.db, body.dishId);
    if (!dish) throw new ApiHttpError(404, 'not_found', 'Dish not found');

    const result = await recordCook(
      deps.db,
      user.id,
      dish,
      photoPath,
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

  app.patch('/api/cooks/:id', async (request): Promise<AddCookPhotoResponse> => {
    const user = requireUser(request);
    const params = z.safeParse(cookIdSchema, request.params);
    if (!params.success) throw new ApiHttpError(404, 'not_found', 'Cook not found');
    const body = parseOr400(addCookPhotoRequestSchema, request.body, 'Invalid photo');
    const photoPath = await ownPhotoPath(deps, user.id, body.photoPath);
    const [cook] = await deps.db
      .select({ photoPath: cooks.photoPath })
      .from(cooks)
      .where(and(eq(cooks.id, params.data.id), eq(cooks.userId, user.id)));
    if (!cook) throw new ApiHttpError(404, 'not_found', 'Cook not found');
    // «Добавляет фото»: a photo already attached is not replaced.
    const updated = await deps.db
      .update(cooks)
      .set({ photoPath })
      .where(and(eq(cooks.id, params.data.id), eq(cooks.userId, user.id), isNull(cooks.photoPath)))
      .returning({ id: cooks.id });
    if (updated.length === 0)
      throw new ApiHttpError(400, 'validation', 'The cook already has a photo');
    return { cookId: params.data.id, photoPath: body.photoPath };
  });
}
