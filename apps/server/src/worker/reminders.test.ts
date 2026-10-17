import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq, inArray } from 'drizzle-orm';
import { Api, HttpError, type Transformer } from 'grammy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { REMINDER_NO_DISH_TEXT, REMINDER_ONBOARDING_TEXT } from '../bot/texts.ts';
import { connect, type Database } from '../db/client.ts';
import { cooks, dishes, users } from '../db/schema.ts';
import { MediaStorage } from '../media/storage.ts';
import type { WorkerLog } from './log.ts';
import { sendDueReminders, type ReminderDeps } from './reminders.ts';
import { cleanShareCards } from './shareCleanup.ts';

/**
 * Reminders and the share cleanup against a real database (`npm run test:db`, after `db:reset`).
 * Bot API calls are intercepted by a transformer; only the users of this test are reminded.
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('worker', () => {
  const WEBAPP_URL = 'https://example.com/app';
  /** 18:00 in Moscow. */
  const NOW = new Date('2026-10-16T15:00:00Z');
  const silent: WorkerLog = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  let database: Database;
  let calls: { method: string; payload: Record<string, unknown> }[] = [];
  /** Error code per method (e.g. `sendPhoto: 400`). */
  let errors: Record<string, number> = {};
  /** Every call fails on the network, as grammY reports it (`HttpError`). */
  let network = false;
  const userIds: string[] = [];
  const base = 8_200_000_000 + Math.floor(Math.random() * 1_000_000) * 100;
  let next = 0;

  const transformer: Transformer = (_prev, method, payload) => {
    calls.push({ method, payload: payload });
    if (network)
      return Promise.reject(new HttpError('Network request failed', new Error('socket hang up')));
    const code = errors[method];
    if (code !== undefined)
      return Promise.resolve({
        ok: false,
        error_code: code,
        description: 'error',
        ...(code === 429 ? { parameters: { retry_after: 1 } } : {}),
      });
    return Promise.resolve({
      ok: true,
      result: { message_id: 1, date: 0, chat: { id: 0, type: 'private' } } as never,
    });
  };

  const api = new Api('42:test-bot-token');
  api.config.use(transformer);

  const deps = (): ReminderDeps => ({
    db: database.db,
    api,
    webAppUrl: WEBAPP_URL,
    mediaUrl: '/media',
    now: () => NOW,
    sleep: () => Promise.resolve(),
    log: silent,
    userIds,
  });

  const newUser = async (fields: Partial<typeof users.$inferInsert> = {}) => {
    next += 1;
    const [row] = await database.db
      .insert(users)
      .values({
        tgId: base + next,
        firstName: 'Напоминание',
        inviteCode: `rm${String(base + next)}`,
        reminderEnabled: true,
        botCanWrite: true,
        onboardedAt: NOW,
        household: 'solo',
        weekdayMinutes: 45,
        ...fields,
      })
      .returning();
    if (!row) throw new Error('user not created');
    userIds.push(row.id);
    return row;
  };

  const userRow = async (id: string) => {
    const [row] = await database.db.select().from(users).where(eq(users.id, id));
    return row;
  };

  beforeAll(() => {
    database = connect();
  });

  beforeEach(async () => {
    calls = [];
    errors = {};
    network = false;
    if (userIds.length > 0) await database.db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  });

  afterAll(async () => {
    if (userIds.length > 0) await database.db.delete(users).where(inArray(users.id, userIds));
    await database.pool.end();
  });

  it('sends the dish of the day with its photo and the open button, once a day', async () => {
    const user = await newUser();
    expect(await sendDueReminders(deps())).toEqual({ sent: 1, blocked: 0, failed: 0 });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.method).toBe('sendPhoto');
    expect(call?.payload.chat_id).toBe(user.tgId);
    expect(call?.payload.photo).toMatch(/^https:\/\/example\.com\/media\/content\/.+\.webp$/);
    expect(call?.payload.caption).toMatch(
      /^Идея ужина на сегодня — .+ \(.+\), \d+ мин\. Рецепт по шагам — в приложении\.$/,
    );
    expect(call?.payload.reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Открыть', web_app: { url: `${WEBAPP_URL}?from=reminder` } }]],
    });
    expect((await userRow(user.id))?.reminderSentOn).toBe('2026-10-16');

    calls = [];
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 0 });
    expect(calls).toHaveLength(0);
  });

  it('takes the first weekday card of the main screen', async () => {
    await newUser();
    await sendDueReminders(deps());
    const [dish] = await database.db
      .select({ title: dishes.title })
      .from(dishes)
      .where(
        eq(dishes.imagePath, String(calls[0]?.payload.photo).split('/media/content/')[1] ?? ''),
      );
    expect(String(calls[0]?.payload.caption)).toContain(`— ${dish?.title ?? '?'} (`);
  });

  it('sends the same text without the photo when Telegram refuses it', async () => {
    await newUser();
    errors = { sendPhoto: 400 };
    expect(await sendDueReminders(deps())).toEqual({ sent: 1, blocked: 0, failed: 0 });
    expect(calls.map((call) => call.method)).toEqual(['sendPhoto', 'sendMessage']);
    expect(calls[1]?.payload.text).toBe(calls[0]?.payload.caption);
  });

  it('asks a user without onboarding to answer the questions', async () => {
    await newUser({ onboardedAt: null, household: null, weekdayMinutes: null });
    await sendDueReminders(deps());
    expect(calls.map((call) => [call.method, call.payload.text])).toEqual([
      ['sendMessage', REMINDER_ONBOARDING_TEXT],
    ]);
  });

  it('sends a text without a dish when nothing fits', async () => {
    await newUser({
      exclusions: ['meat', 'spicy', 'gluten'],
      customExclusions: ['а', 'е', 'о', 'и'],
    });
    await sendDueReminders(deps());
    expect(calls.map((call) => [call.method, call.payload.text])).toEqual([
      ['sendMessage', REMINDER_NO_DISH_TEXT],
    ]);
  });

  it('resets bot_can_write when the bot is blocked', async () => {
    const user = await newUser();
    errors = { sendPhoto: 403 };
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 1, failed: 0 });
    expect((await userRow(user.id))?.botCanWrite).toBe(false);
  });

  it('waits on 429 and releases the day when the retries are used up', async () => {
    const user = await newUser({ reminderSentOn: '2026-10-15' });
    errors = { sendPhoto: 429 };
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 1 });
    // The photo and 3 retries after `retry_after`; 429 is not a refused photo, so no text fallback.
    expect(calls.every((call) => call.method === 'sendPhoto')).toBe(true);
    expect(calls).toHaveLength(4);
    expect((await userRow(user.id))?.reminderSentOn).toBe('2026-10-15');
  });

  it('releases the day after a Telegram server error', async () => {
    const user = await newUser({ reminderSentOn: '2026-10-15' });
    errors = { sendPhoto: 400, sendMessage: 502 };
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 1 });
    expect((await userRow(user.id))?.reminderSentOn).toBe('2026-10-15');
    errors = {};
    expect((await sendDueReminders(deps())).sent).toBe(1);
  });

  it('keeps the day after another 4xx: no retry every minute', async () => {
    const user = await newUser();
    errors = { sendPhoto: 400, sendMessage: 400 };
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 1 });
    expect((await userRow(user.id))?.reminderSentOn).toBe('2026-10-16');
    calls = [];
    await sendDueReminders(deps());
    expect(calls).toHaveLength(0);
  });

  it('keeps the day after a network error: the message may have been sent', async () => {
    const user = await newUser();
    network = true;
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 1 });
    expect((await userRow(user.id))?.reminderSentOn).toBe('2026-10-16');
  });

  it('skips users who are not due, switched off or unreachable', async () => {
    await newUser({ reminderTime: '19:00' });
    await newUser({ reminderTime: '15:30' });
    await newUser({ reminderEnabled: false });
    await newUser({ botCanWrite: false });
    await newUser({ reminderSentOn: '2026-10-16' });
    await newUser({ timezone: 'Asia/Vladivostok' });
    expect(await sendDueReminders(deps())).toEqual({ sent: 0, blocked: 0, failed: 0 });
    expect(calls).toHaveLength(0);
  });

  it('sends a missed reminder up to two hours late', async () => {
    await newUser({ reminderTime: '16:00' });
    expect((await sendDueReminders(deps())).sent).toBe(1);
  });

  it('deletes old share cards and forgets them in cooks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tma80-worker-'));
    try {
      const media = new MediaStorage(root);
      const user = await newUser();
      const [dish] = await database.db
        .select({ id: dishes.id, countryId: dishes.countryId })
        .from(dishes)
        .limit(1);
      if (!dish) throw new Error('no content: run npm run db:reset');
      const old = await media.saveShareCard(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
      const fresh = await media.saveShareCard(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
      const longAgo = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
      await utimes(join(root, 'share', old), longAgo, longAgo);
      const [oldCook, freshCook] = await database.db
        .insert(cooks)
        .values([
          {
            id: randomUUID(),
            userId: user.id,
            dishId: dish.id,
            countryId: dish.countryId,
            shareCard: old,
          },
          {
            id: randomUUID(),
            userId: user.id,
            dishId: dish.id,
            countryId: dish.countryId,
            shareCard: fresh,
          },
        ])
        .returning();
      expect(await cleanShareCards({ db: database.db, media, now: () => NOW })).toBe(1);
      const cards = await database.db
        .select({ id: cooks.id, shareCard: cooks.shareCard })
        .from(cooks)
        .where(eq(cooks.userId, user.id));
      expect(new Map(cards.map((cook) => [cook.id, cook.shareCard]))).toEqual(
        new Map([
          [oldCook?.id, null],
          [freshCook?.id, fresh],
        ]),
      );
      expect(await media.shareCardExists(fresh)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
