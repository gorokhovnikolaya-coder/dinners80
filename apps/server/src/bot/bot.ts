import { Bot, GrammyError, InlineKeyboard, type Context, type Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

import type { Db } from '../db/client.ts';
import { setBotCanWrite, startBot, type BotUser } from '../db/users.ts';
import {
  inviteText,
  OPEN_BUTTON,
  paySupportText,
  START_TEXT,
  termsText,
  type DocumentLinks,
} from './texts.ts';

export interface BotSettings extends DocumentLinks {
  /** HTTPS URL of the mini app (`WEBAPP_URL`) for the web_app buttons. */
  webAppUrl: string;
  /** Payment support contact (`SUPPORT_CONTACT`); `null` — a placeholder. */
  supportContact: string | null;
  /** Known `getMe` result: skips the network call on start (tests). */
  botInfo?: UserFromGetMe;
  /** Bot API call transformer: tests intercept calls with it instead of the network. */
  apiTransformer?: Transformer;
}

export interface BotDeps extends BotSettings {
  db: Db;
  token: string;
  now: () => Date;
}

/** Longest `start` parameter Telegram allows (deep links, `[A-Za-z0-9_-]{1,64}`). */
const START_PARAM_MAX = 64;

/** Invite code of `/start <code>`, or `null` without a usable payload. */
export function startPayload(match: string): string | null {
  const code = match.trim();
  return code !== '' && code.length <= START_PARAM_MAX && /^[A-Za-z0-9_-]+$/.test(code)
    ? code
    : null;
}

const botUserOf = (from: NonNullable<Context['from']>): BotUser => ({
  tgId: from.id,
  firstName: from.first_name,
  username: from.username ?? null,
});

/**
 * The bot (grammY, webhook mode; ТЗ, «Бот»): `/start` with an optional invite code, `/terms`,
 * `/paysupport`, a greeting for any other text, and `bot_can_write` from `/start`,
 * `write_access_allowed` and the blocked / unblocked status. Only private chats are served.
 * Payments (`pre_checkout_query`, `successful_payment`) are added in task 19.
 */
export function createBot(deps: BotDeps): Bot {
  const bot = new Bot(deps.token, deps.botInfo === undefined ? {} : { botInfo: deps.botInfo });
  if (deps.apiTransformer) bot.api.config.use(deps.apiTransformer);
  const openKeyboard = new InlineKeyboard().webApp(OPEN_BUTTON, deps.webAppUrl);

  /**
   * Sends a message; if the user has blocked the bot meanwhile (403), resets `bot_can_write`
   * instead of failing the update (Telegram would retry it in vain). Other errors are thrown:
   * the webhook answers 500 and Telegram retries the update later.
   */
  const reply = async (
    ctx: Context,
    text: string,
    keyboard: InlineKeyboard | null,
  ): Promise<void> => {
    try {
      await ctx.reply(text, keyboard === null ? {} : { reply_markup: keyboard });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 403 && ctx.from) {
        await setBotCanWrite(deps.db, ctx.from.id, false);
        return;
      }
      throw error;
    }
  };

  const chat = bot.chatType('private');

  chat.command('start', async (ctx) => {
    const code = startPayload(ctx.match);
    const { inviter } = await startBot(deps.db, botUserOf(ctx.from), code, deps.now());
    await reply(ctx, inviter === null ? START_TEXT : inviteText(inviter.firstName), openKeyboard);
  });

  chat.command('terms', async (ctx) => {
    await reply(ctx, termsText(deps), null);
  });

  chat.command('paysupport', async (ctx) => {
    await reply(ctx, paySupportText(deps.supportContact), null);
  });

  // The user allowed the bot to write from the mini app (`requestWriteAccess`).
  chat.on('message:write_access_allowed', async (ctx) => {
    await setBotCanWrite(deps.db, ctx.from.id, true);
  });

  chat.on('message:text', async (ctx) => {
    await reply(ctx, START_TEXT, openKeyboard);
  });

  // Blocked («kicked») or unblocked («member») the bot in the private chat.
  chat.on('my_chat_member', async (ctx) => {
    const { status } = ctx.myChatMember.new_chat_member;
    if (status === 'kicked') await setBotCanWrite(deps.db, ctx.from.id, false);
    else if (status === 'member') await setBotCanWrite(deps.db, ctx.from.id, true);
  });

  return bot;
}
