import { z } from 'zod/mini';

import type { Db } from '../db/client.ts';
import { ApiHttpError } from '../http/errors.ts';

/** What the API routes need. */
export interface RouteDeps {
  db: Db;
  now: () => Date;
  /** Public base URL of media files without a trailing slash, e.g. `/media`. */
  mediaUrl: string;
}

/**
 * Parses a request part with a shared zod schema.
 * @throws `400 validation` with `message` if it does not match.
 */
export function parseOr400<T extends z.core.$ZodType>(
  schema: T,
  value: unknown,
  message: string,
): z.output<T> {
  const result = z.safeParse(schema, value);
  if (!result.success) throw new ApiHttpError(400, 'validation', message);
  return result.data;
}
