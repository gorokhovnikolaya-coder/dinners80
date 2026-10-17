import { Bot, GrammyError, InlineKeyboard, type Context, type Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

import type { Db } from '../db/client.ts';
import { checkoutRefusal, markRefunded, recordPayment } from '../db/payments.ts';
import { setBotCanWrite, startBot, type BotUser } from '../db/users.ts';
import {
  CHECKOUT_REFUSAL_TEXTS,
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
  /** Log of payments that need a human (e.g. a payment of an unknown user). */
  log?: (message: string, details: Record<string, unknown>) => void;
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
 * Payments in Stars (decision 0021): `pre_checkout_query` checks the invoice, `successful_payment`
 * records the subscription, `refunded_payment` ends it; the bot sends nothing after a payment.
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

  // The payment is confirmed only after `successful_payment`; answer within 10 s.
  bot.on('pre_checkout_query', async (ctx) => {
    const refusal = await checkoutRefusal(deps.db, ctx.preCheckoutQuery, deps.now());
    await (refusal === null
      ? ctx.answerPreCheckoutQuery(true)
      : ctx.answerPreCheckoutQuery(false, { error_message: CHECKOUT_REFUSAL_TEXTS[refusal] }));
  });

  chat.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const result = await recordPayment(deps.db, payment, ctx.from.id, deps.now());
    if (result.kind === 'unknown_user') {
      deps.log?.('Payment of an unknown user is not recorded', {
        tgId: ctx.from.id,
        chargeId: payment.telegram_payment_charge_id,
        amount: payment.total_amount,
      });
    }
  });

  chat.on('message:refunded_payment', async (ctx) => {
    await markRefunded(deps.db, ctx.message.refunded_payment.telegram_payment_charge_id);
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
