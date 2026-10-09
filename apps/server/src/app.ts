import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { healthRoutes } from './routes/health.ts';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);
  healthRoutes(app);
  return app;
}
