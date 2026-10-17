import { z } from 'zod/mini';

/** Error codes of the API. */
export const API_ERROR_CODES = [
  'unauthorized',
  'paywall',
  'rate_limited',
  'not_found',
  'validation',
  /** The action conflicts with the current state (e.g. a second monthly subscription). */
  'conflict',
  /** Unexpected server error (HTTP 5xx). */
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Single error format of the API: `{error: {code, message}}`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
