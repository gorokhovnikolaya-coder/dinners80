import { createHmac } from 'node:crypto';

/**
 * `secret_token` of the bot webhook (`X-Telegram-Bot-Api-Secret-Token`), derived from the bot
 * token: HMAC-SHA256 with a fixed label, 64 hex characters (Telegram allows 1–256 of
 * `[A-Za-z0-9_-]`). No separate secret to keep in sync: `npm run bot:setup` and the server compute
 * the same value, and it changes together with the token (decision 0020).
 */
export function webhookSecret(botToken: string): string {
  return createHmac('sha256', 'tma80-bot-webhook').update(botToken).digest('hex');
}
