import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  COOK_PHOTO_FIELD,
  COOK_PHOTO_MAX_BYTES,
  COOK_PHOTO_UPLOADS_PER_DAY_LIMIT,
  SHARE_CARD_FIELD,
  SHARE_CARD_MAX_BYTES,
  type UploadCookPhotoResponse,
  type UploadShareCardResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { ApiHttpError } from '../http/errors.ts';
import { COOKS_DIR, SHARE_DIR, isJpeg } from '../media/storage.ts';
import type { RouteDeps } from './deps.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the only file of a multipart request into memory (at most `maxBytes`, checked while
 * streaming: a larger one fails with `413`) and checks that it is a JPEG.
 */
async function readJpeg(request: FastifyRequest, field: string, maxBytes: number) {
  if (!request.isMultipart())
    throw new ApiHttpError(400, 'validation', 'multipart/form-data is expected');
  const part = await request.file({
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 1 },
  });
  if (part?.fieldname !== field)
    throw new ApiHttpError(400, 'validation', `A JPEG file in «${field}» is expected`);
  const data = await part.toBuffer();
  if (!isJpeg(data)) throw new ApiHttpError(400, 'validation', 'A JPEG file is expected');
  return data;
}

/**
 * `POST /uploads/cook-photo` (private `cooks` folder, ≤ 500 KB, at most
 * `COOK_PHOTO_UPLOADS_PER_DAY_LIMIT` per 24 hours) and `POST /uploads/share-card` (public `share`
 * folder, ≤ 2 MB). The server stores the bytes as they come: the client has compressed them.
 */
export function uploadRoutes(app: FastifyInstance, deps: RouteDeps): void {
  // Uploads of one user are counted and saved one at a time, so parallel ones cannot pass the limit.
  const queues = new Map<string, Promise<unknown>>();
  const oneAtATime = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    const settled = run.catch(() => undefined);
    queues.set(key, settled);
    void settled.then(() => {
      if (queues.get(key) === settled) queues.delete(key);
    });
    return run;
  };

  void app.register(async (scope) => {
    await scope.register(multipart);

    scope.post('/api/uploads/cook-photo', async (request, reply) => {
      const user = requireUser(request);
      const photoPath = await oneAtATime(user.id, async () => {
        const since = new Date(deps.now().getTime() - DAY_MS);
        if ((await deps.media.cookPhotosSince(user.id, since)) >= COOK_PHOTO_UPLOADS_PER_DAY_LIMIT)
          throw new ApiHttpError(429, 'rate_limited', 'Too many photos today');
        const data = await readJpeg(request, COOK_PHOTO_FIELD, COOK_PHOTO_MAX_BYTES);
        return deps.media.saveCookPhoto(user.id, data);
      });
      reply.code(201);
      return { photoPath: `${COOKS_DIR}/${photoPath}` } satisfies UploadCookPhotoResponse;
    });

    scope.post('/api/uploads/share-card', async (request, reply) => {
      requireUser(request);
      const data = await readJpeg(request, SHARE_CARD_FIELD, SHARE_CARD_MAX_BYTES);
      const name = await deps.media.saveShareCard(data);
      reply.code(201);
      return { url: `${deps.mediaUrl}/${SHARE_DIR}/${name}` } satisfies UploadShareCardResponse;
    });
  });
}
