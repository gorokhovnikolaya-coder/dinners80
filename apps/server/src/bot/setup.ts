import { Api } from 'grammy';

import { botToken, publicUrl, webAppUrl } from '../config.ts';
import { BOT_WEBHOOK_PATH } from '../routes/botWebhook.ts';
import { webhookSecret } from './secret.ts';
import { BOT_COMMANDS, OPEN_BUTTON } from './texts.ts';

/**
 * `npm run bot:setup` (run by a human against the real bot, not in CI): points the webhook to
 * `${PUBLIC_URL}/api/bot/webhook` with the derived secret, sets the commands and the chat menu
 * button that opens the mini app (`WEBAPP_URL`). Safe to repeat.
 */
const token = botToken();
const appUrl = webAppUrl();
if (appUrl === null) throw new Error('WEBAPP_URL is not set: the https address of the mini app');
const api = new Api(token);

await api.setWebhook(`${publicUrl()}${BOT_WEBHOOK_PATH}`, {
  secret_token: webhookSecret(token),
  // Payments (`pre_checkout_query`) are added with task 19: run the setup again then.
  allowed_updates: ['message', 'my_chat_member'],
});
await api.setMyCommands([...BOT_COMMANDS]);
await api.setChatMenuButton({
  menu_button: { type: 'web_app', text: OPEN_BUTTON, web_app: { url: appUrl } },
});

const info = await api.getWebhookInfo();
console.info(`Webhook: ${info.url ?? "-"} (pending updates: ${String(info.pending_update_count)})`);
