import type { FastifyInstance } from 'fastify';
import type { Api } from 'grammy';

import {
  createInvoiceRequestSchema,
  invoicePayload,
  STARS_CURRENCY,
  SUBSCRIPTION_PERIOD_SECONDS,
  SUBSCRIPTION_PRICES_STARS,
  type CreateInvoiceResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { INVOICE_TEXTS } from '../bot/texts.ts';
import { hasActiveMonth } from '../db/payments.ts';
import { ApiHttpError } from '../http/errors.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/**
 * `POST /payments/invoice` (ТЗ, «Оплата в Stars»): a Telegram Stars invoice link for the plan —
 * `createInvoiceLink` in `XTR` with an empty `provider_token` and one price; the month is a
 * subscription renewed every 30 days, the year a one-off payment. The price comes from the server.
 * A second monthly subscription while one is active answers `409 conflict` (decision 0021).
 */
export function paymentRoutes(app: FastifyInstance, deps: RouteDeps & { botApi: Api }): void {
  app.post('/api/payments/invoice', async (request, reply): Promise<CreateInvoiceResponse> => {
    const { plan } = parseOr400(createInvoiceRequestSchema, request.body, 'Invalid plan');
    const user = requireUser(request);
    if (plan === 'month' && (await hasActiveMonth(deps.db, user.id, deps.now()))) {
      throw new ApiHttpError(409, 'conflict', 'The monthly subscription is already active');
    }
    const price = SUBSCRIPTION_PRICES_STARS[plan];
    const texts = INVOICE_TEXTS[plan];
    const invoiceLink = await deps.botApi.createInvoiceLink(
      texts.title,
      texts.description,
      invoicePayload({ plan, userId: user.id }),
      '',
      STARS_CURRENCY,
      [{ label: texts.title, amount: price }],
      plan === 'month' ? { subscription_period: SUBSCRIPTION_PERIOD_SECONDS } : {},
    );
    return reply.code(201).send({ invoiceLink });
  });
}
