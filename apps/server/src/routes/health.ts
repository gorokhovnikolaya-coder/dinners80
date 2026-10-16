import type { FastifyInstance } from 'fastify';

import type { HealthResponse } from '@tma80/shared';

export function healthRoutes(app: FastifyInstance): void {
  app.get('/api/health', { config: { auth: 'public' } }, (): HealthResponse => ({ status: 'ok' }));
}
