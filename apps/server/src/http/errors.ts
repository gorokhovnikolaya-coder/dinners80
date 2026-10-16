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
    request.log.error(error);
    return reply.code(500).send(body('internal', 'Internal server error'));
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send(body('not_found', 'Not found')));
}
