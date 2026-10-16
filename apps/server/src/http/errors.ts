import { DrizzleQueryError } from 'drizzle-orm';
import type { FastifyError, FastifyInstance } from 'fastify';

import type { ApiError, ApiErrorCode } from '@tma80/shared';

/** An error that becomes `{error: {code, message}}` with the given HTTP status. */
export class ApiHttpError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Postgres error (from `pg`): has a SQLSTATE `code`. */
interface PgErrorLike extends Error {
  code: string;
  constraint?: unknown;
}

const isPgError = (error: unknown): error is PgErrorLike =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';

/**
 * What goes to the log about an unexpected error: name, message and the Postgres code, never the
 * query parameters. `DrizzleQueryError` puts the SQL and its parameters (user data) into its
 * message and stack, so only the message of its cause is logged; Postgres messages themselves carry
 * no values (those are in `detail`, which is dropped).
 */
export function safeErrorLog(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return { name: 'NonError', message: 'Non-error thrown' };
  const log: Record<string, string> = { name: error.name };
  let cause: unknown = error;
  while (cause instanceof DrizzleQueryError) cause = cause.cause;
  if (isPgError(cause)) {
    log.message = cause.message;
    log.pgCode = cause.code;
    if (typeof cause.constraint === 'string') log.constraint = cause.constraint;
  } else if (cause instanceof Error) {
    log.message = cause.message;
    if (cause === error && cause.stack !== undefined) log.stack = cause.stack;
  } else {
    log.message = 'Database query failed';
  }
  return log;
}

const body = (code: ApiErrorCode, message: string): ApiError => ({ error: { code, message } });

/** Single error format of the API (ТЗ, «Правила сервера»). */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | ApiHttpError, request, reply) => {
    if (error instanceof ApiHttpError) {
      return reply.code(error.statusCode).send(body(error.code, error.message));
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      // Fastify's own client errors: malformed JSON, wrong content type, body too large.
      return reply.code(status).send(body('validation', error.message));
    }
    request.log.error({ err: safeErrorLog(error) }, 'Unexpected error');
    return reply.code(500).send(body('internal', 'Internal server error'));
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send(body('not_found', 'Not found')));
}
