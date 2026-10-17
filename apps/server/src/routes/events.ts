import type { FastifyInstance } from 'fastify';

import { eventsRequestSchema, type EventsResponse } from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { events } from '../db/schema.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/**
 * `POST /events`: a batch of the client's analytics events (ТЗ, «Аналитика»; decision 0024).
 * The user comes from initData; the time is the server's (the batch is sent within seconds), the
 * order of the batch is kept by a millisecond step. Server-side events are not accepted here.
 */
export function eventRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.post('/api/events', async (request): Promise<EventsResponse> => {
    const body = parseOr400(eventsRequestSchema, request.body, 'Invalid events');
    const user = requireUser(request);
    const at = deps.now().getTime() - body.events.length;
    await deps.db.insert(events).values(
      body.events.map((event, index) => ({
        userId: user.id,
        name: event.name,
        props: event.props,
        createdAt: new Date(at + index + 1),
      })),
    );
    return { stored: body.events.length };
  });
}
