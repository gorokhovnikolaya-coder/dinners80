import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { GrammyError, InlineKeyboard, type Api } from 'grammy';

import { absoluteMediaUrl, dueReminderDate, suggestDishes } from '@tma80/shared';

import {
  OPEN_BUTTON,
  REMINDER_NO_DISH_TEXT,
  REMINDER_ONBOARDING_TEXT,
  reminderDishText,
} from '../bot/texts.ts';
import type { Db } from '../db/client.ts';
import { contentImageUrl, loadPublishedContent, type PublishedContent } from '../db/content.ts';
import { cooksOf } from '../db/cooks.ts';
import { users } from '../db/schema.ts';
import { setBotCanWrite, subscriptionStatus, toUserProfile, type UserRow } from '../db/users.ts';
import type { WorkerLog } from './log.ts';

/** Pause between two reminders: ≤ 25 messages a second, under the Bot API limit of ~30. */
export const SEND_INTERVAL_MS = 40;
/** How many times a message is retried after `429 Too Many Requests`. */
const RATE_LIMIT_RETRIES = 3;

export interface ReminderDeps {
  db: Db;
  /** Bot API client (grammY). */
  api: Api;
  /** `WEBAPP_URL`: the «Открыть» button opens the main screen; its origin makes photo URLs absolute. */
  webAppUrl: string;
  /** `MEDIA_URL`: base URL of content photos. */
  mediaUrl: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: WorkerLog;
  /** Only these users (tests: the local database also holds the dev users). */
  userIds?: readonly string[];
}

export interface ReminderMessage {
  text: string;
  /** Absolute URL of the dish photo; the text is its caption. `null` — a text message. */
  photoUrl: string | null;
}

export interface ReminderResult {
  sent: number;
  /** The bot is blocked (403): `bot_can_write` is reset. */
  blocked: number;
  /** Not sent for another reason: retried on the next tick while the reminder is still due. */
  failed: number;
}

/**
 * The reminder of the user (ТЗ, «Бот»; decision 0023): the dish of the day — the first card of the
 * «Будни» suggestions as the main screen shows it today — with its photo; without onboarding
 * answers or without a fitting open dish, a text without a dish.
 */
export async function reminderMessage(
  deps: Pick<ReminderDeps, 'db' | 'webAppUrl' | 'mediaUrl'>,
  user: UserRow,
  content: PublishedContent,
  now: Date,
): Promise<ReminderMessage> {
  if (user.onboardedAt === null) return { text: REMINDER_ONBOARDING_TEXT, photoUrl: null };
  const [userCooks, subscription] = await Promise.all([
    cooksOf(deps.db, [user.id]),
    subscriptionStatus(deps.db, user.id, now),
  ]);
  const { suggestions } = suggestDishes({
    dishes: content.dishes,
    cooks: userCooks,
    user: { ...toUserProfile(user), subscribed: subscription.active },
    mode: 'weekday',
    page: 0,
    now,
  });
  const first = suggestions[0];
  const dish = first && !first.locked ? content.dishes.find((d) => d.id === first.dishId) : null;
  const country = dish && content.countries.find((c) => c.id === dish.countryId);
  if (!dish || !country) return { text: REMINDER_NO_DISH_TEXT, photoUrl: null };
  return {
    text: reminderDishText({
      title: dish.title,
      countryName: country.nameRu,
      minutes: dish.minutes,
    }),
    photoUrl: absoluteMediaUrl(contentImageUrl(deps.mediaUrl, dish.imagePath), deps.webAppUrl),
  };
}

/** Runs a Bot API call, waiting `retry_after` on `429` a few times. */
async function withRateLimit<T>(
  deps: Pick<ReminderDeps, 'sleep'>,
  call: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const retryAfter =
        error instanceof GrammyError && error.error_code === 429
          ? (error.parameters.retry_after ?? 1)
          : null;
      if (retryAfter === null || attempt >= RATE_LIMIT_RETRIES) throw error;
      await deps.sleep(retryAfter * 1000);
    }
  }
}

/**
 * Sends the message: the photo with the caption, or the same text alone if Telegram cannot take
 * the photo (`400`, e.g. the photo is not published yet).
 */
async function sendReminder(
  deps: ReminderDeps,
  chatId: number,
  message: ReminderMessage,
): Promise<void> {
  const reply_markup = new InlineKeyboard().webApp(OPEN_BUTTON, deps.webAppUrl);
  const { photoUrl } = message;
  if (photoUrl !== null) {
    try {
      await withRateLimit(deps, () =>
        deps.api.sendPhoto(chatId, photoUrl, { caption: message.text, reply_markup }),
      );
      return;
    } catch (error) {
      if (!(error instanceof GrammyError && error.error_code === 400)) throw error;
      deps.log.warn('reminder photo refused, sending text', { photoUrl, error: error.description });
    }
  }
  await withRateLimit(deps, () => deps.api.sendMessage(chatId, message.text, { reply_markup }));
}

/**
 * Sends the due dinner reminders (ТЗ, «Бот»): one a day at `reminder_time` of the user's time
 * zone, only with `reminder_enabled` and `bot_can_write`; a missed one goes out up to two hours
 * late on the same local day (decision 0023). The day is claimed in the database before sending,
 * so two workers or ticks never send it twice; a failed send releases the claim. `403` (the bot
 * is blocked) resets `bot_can_write`.
 */
export async function sendDueReminders(deps: ReminderDeps): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, blocked: 0, failed: 0 };
  const now = deps.now();
  const enabled = and(eq(users.reminderEnabled, true), eq(users.botCanWrite, true));
  const candidates = await deps.db
    .select({
      id: users.id,
      timezone: users.timezone,
      reminderTime: users.reminderTime,
      reminderSentOn: users.reminderSentOn,
    })
    .from(users)
    .where(
      deps.userIds === undefined ? enabled : and(enabled, inArray(users.id, [...deps.userIds])),
    );
  const due = candidates.flatMap((user) => {
    const date = dueReminderDate(
      { timezone: user.timezone, reminderTime: user.reminderTime, sentOn: user.reminderSentOn },
      now,
    );
    return date === null ? [] : [{ id: user.id, date, previous: user.reminderSentOn }];
  });
  if (due.length === 0) return result;

  const content = await loadPublishedContent(deps.db);
  for (const [index, item] of due.entries()) {
    if (index > 0) await deps.sleep(SEND_INTERVAL_MS);
    const [user] = await deps.db
      .update(users)
      .set({ reminderSentOn: item.date })
      .where(
        and(
          eq(users.id, item.id),
          enabled,
          or(isNull(users.reminderSentOn), ne(users.reminderSentOn, item.date)),
        ),
      )
      .returning();
    if (!user) continue;
    try {
      await sendReminder(deps, user.tgId, await reminderMessage(deps, user, content, now));
      result.sent += 1;
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 403) {
        await setBotCanWrite(deps.db, user.tgId, false);
        result.blocked += 1;
        continue;
      }
      result.failed += 1;
      await deps.db
        .update(users)
        .set({ reminderSentOn: item.previous })
        .where(and(eq(users.id, user.id), eq(users.reminderSentOn, item.date)));
      deps.log.error('reminder not sent', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}
