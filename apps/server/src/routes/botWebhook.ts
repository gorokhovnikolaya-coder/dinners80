import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { webhookCallback, type Bot } from 'grammy';

import { webhookSecret } from '../bot/secret.ts';
import { ApiHttpError } from '../http/errors.ts';

/** Path of the bot webhook (`setWebhook` URL is `${PUBLIC_URL}${BOT_WEBHOOK_PATH}`). */
export const BOT_WEBHOOK_PATH = '/api/bot/webhook';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/** Constant-time comparison of strings of any length (hashes have equal lengths). */
const sameSecret = (given: string, expected: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(expected).digest(),
  );

/**
 * `POST /bot/webhook`: updates from Telegram. No initData (`auth: 'public'`); a request without the
 * right `X-Telegram-Bot-Api-Secret-Token` gets `401 unauthorized` before the body is handled and
 * before grammY's first `getMe`. grammY checks the secret too and answers 500 if handling fails,
 * so Telegram retries the update.
 */
export function botWebhookRoutes(app: FastifyInstance, deps: { bot: Bot; botToken: string }): void {
  const secret = webhookSecret(deps.botToken);
  const handle = webhookCallback(deps.bot, 'fastify', { secretToken: secret });
  app.post(
    BOT_WEBHOOK_PATH,
    {
      config: { auth: 'public' },
      onRequest: (request, _reply, done) => {
        const header = request.headers[SECRET_HEADER];
        done(
          typeof header === 'string' && sameSecret(header, secret)
            ? undefined
            : new ApiHttpError(401, 'unauthorized', 'Invalid webhook secret token'),
        );
      },
    },
    handle,
  );
}
