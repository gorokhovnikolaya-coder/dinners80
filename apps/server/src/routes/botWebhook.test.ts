import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq, inArray } from 'drizzle-orm';
import type { Transformer } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { authResponseSchema, leaderboardResponseSchema } from '@tma80/shared';

import { buildApp } from '../app.ts';
import { signInitData } from '../auth/initData.ts';
import { webhookSecret } from '../bot/secret.ts';
import { inviteText, START_TEXT } from '../bot/texts.ts';
import { connect, type Database } from '../db/client.ts';
import { events, friendships, users } from '../db/schema.ts';
import { BOT_WEBHOOK_PATH } from './botWebhook.ts';

/**
 * The bot webhook against a real database (`npm run test:db`). Bot API calls are intercepted by a
 * transformer: nothing goes to Telegram. Users get random `tg_id`s and are deleted afterwards.
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('POST /api/bot/webhook', () => {
  const TOKEN = '42:test-bot-token';
  const WEBAPP_URL = 'https://example.com/app';
  const botInfo: UserFromGetMe = {
    id: 42,
    is_bot: true,
    first_name: 'Тест',
    username: 'tma80_test_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: true,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  let database: Database;
  let app: ReturnType<typeof buildApp>;
  /** Bot API calls of the current test. */
  let calls: { method: string; payload: Record<string, unknown> }[] = [];
  /** Error code to answer `sendMessage` with (e.g. 403 — the bot is blocked). */
  let sendError: number | null = null;
  const base = 8_100_000_000 + Math.floor(Math.random() * 1_000_000) * 100;
  let next = 0;
  let updateId = 0;
  const tgIds: number[] = [];

  const newTgId = () => {
    next += 1;
    const id = base + next;
    tgIds.push(id);
    return id;
  };

  const transformer: Transformer = (_prev, method, payload) => {
    calls.push({ method, payload: payload });
    if (method === 'sendMessage' && sendError !== null) {
      return Promise.resolve({
        ok: false,
        error_code: sendError,
        description: 'Forbidden: bot was blocked',
      });
    }
    // A stub result for any method: the bot only sends messages and ignores the answer.
    return Promise.resolve({
      ok: true,
      result: { message_id: 1, date: 0, chat: { id: 0, type: 'private' } } as never,
    });
  };

  const from = (tgId: number, firstName = `Бот ${String(tgId)}`) => ({
    id: tgId,
    is_bot: false,
    first_name: firstName,
    username: `u${String(tgId)}`,
  });

  const message = (tgId: number, fields: Record<string, unknown>): Update => {
    updateId += 1;
    return {
      update_id: updateId,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: tgId, type: 'private', first_name: 'x' },
        from: from(tgId),
        ...fields,
      },
    };
  };

  const text = (tgId: number, value: string): Update => {
    const command = /^\/\w+/.exec(value)?.[0];
    return message(tgId, {
      text: value,
      ...(command === undefined
        ? {}
        : { entities: [{ type: 'bot_command', offset: 0, length: command.length }] }),
    });
  };

  const chatMember = (tgId: number, status: 'kicked' | 'member'): Update => {
    updateId += 1;
    const bot = { id: botInfo.id, is_bot: true, first_name: botInfo.first_name };
    return {
      update_id: updateId,
      my_chat_member: {
        chat: { id: tgId, type: 'private', first_name: 'x' },
        from: from(tgId),
        date: Math.floor(Date.now() / 1000),
        old_chat_member:
          status === 'kicked'
            ? { status: 'member', user: bot }
            : { status: 'kicked', user: bot, until_date: 0 },
        new_chat_member:
          status === 'kicked'
            ? { status: 'kicked', user: bot, until_date: 0 }
            : { status: 'member', user: bot },
      },
    };
  };

  const post = (update: Update, secret: string | null = webhookSecret(TOKEN)) =>
    app.inject({
      method: 'POST',
      url: BOT_WEBHOOK_PATH,
      headers: secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret },
      payload: update,
    });

  const deliver = async (update: Update) => {
    const response = await post(update);
    expect(response.statusCode).toBe(200);
  };

  const userByTgId = async (tgId: number) => {
    const [row] = await database.db.select().from(users).where(eq(users.tgId, tgId));
    return row;
  };

  const friendsOf = async (userId: string) =>
    (
      await database.db
        .select({ friendId: friendships.friendId })
        .from(friendships)
        .where(eq(friendships.userId, userId))
    ).map((row) => row.friendId);

  const inviteEvents = async (userId: string) =>
    database.db.select().from(events).where(eq(events.userId, userId));

  const initData = (tgId: number, startParam?: string) =>
    `tma ${signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: tgId, first_name: `Тест ${String(tgId)}` }),
        ...(startParam === undefined ? {} : { start_param: startParam }),
      },
      TOKEN,
    )}`;

  const signIn = async (tgId: number, startParam?: string) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization: initData(tgId, startParam) },
    });
    expect(response.statusCode).toBe(200);
    return authResponseSchema.parse(response.json());
  };

  const sent = () => calls.filter((call) => call.method === 'sendMessage');

  beforeAll(() => {
    database = connect();
    app = buildApp({
      db: database.db,
      botToken: TOKEN,
      mediaDir: join(tmpdir(), 'tma80-unused-media'),
      mediaSigningKey: 'k'.repeat(32),
      bot: {
        webAppUrl: WEBAPP_URL,
        termsUrl: 'https://example.com/terms',
        privacyUrl: null,
        supportContact: '@help',
        botInfo,
        apiTransformer: transformer,
      },
    });
  });

  beforeEach(() => {
    calls = [];
    sendError = null;
  });

  afterAll(async () => {
    const created = await database.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.tgId, tgIds));
    const ids = created.map((row) => row.id);
    if (ids.length > 0) {
      await database.db.delete(events).where(inArray(events.userId, ids));
      await database.db.delete(users).where(inArray(users.id, ids));
    }
    await app.close();
    await database.pool.end();
  });

  it('rejects a request without the right secret token', async () => {
    const tgId = newTgId();
    const missing = await post(text(tgId, '/start'), null);
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({ error: { code: 'unauthorized' } });
    expect((await post(text(tgId, '/start'), webhookSecret('42:other'))).statusCode).toBe(401);
    expect(await userByTgId(tgId)).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('/start creates the user with reminders on and answers with the open button', async () => {
    const tgId = newTgId();
    await deliver(text(tgId, '/start'));

    const user = await userByTgId(tgId);
    expect(user).toMatchObject({
      firstName: `Бот ${String(tgId)}`,
      username: `u${String(tgId)}`,
      botCanWrite: true,
      reminderEnabled: true,
      invitedBy: null,
      onboardedAt: null,
    });
    expect(user?.botStartedAt).toBeInstanceOf(Date);
    expect(user?.inviteCode).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(sent()).toEqual([
      {
        method: 'sendMessage',
        payload: expect.objectContaining({
          chat_id: tgId,
          text: START_TEXT,
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть', web_app: { url: WEBAPP_URL } }]],
          },
        }) as unknown,
      },
    ]);
  });

  it('switches reminders on only at the first /start', async () => {
    const tgId = newTgId();
    const { user } = await signIn(tgId);
    expect(user).toMatchObject({ botCanWrite: false, reminderEnabled: false });

    await deliver(text(tgId, '/start'));
    expect(await userByTgId(tgId)).toMatchObject({
      id: user.id,
      botCanWrite: true,
      reminderEnabled: true,
    });

    await database.db.update(users).set({ reminderEnabled: false }).where(eq(users.id, user.id));
    await deliver(text(tgId, '/start'));
    expect(await userByTgId(tgId)).toMatchObject({ botCanWrite: true, reminderEnabled: false });
  });

  it('/start <code> befriends a new user and names the inviter', async () => {
    const inviter = await signIn(newTgId());
    const tgId = newTgId();
    await deliver(text(tgId, `/start ${inviter.user.inviteCode}`));

    const user = await userByTgId(tgId);
    if (!user) throw new Error('no user');
    expect(user.invitedBy).toBe(inviter.user.id);
    expect(await friendsOf(user.id)).toEqual([inviter.user.id]);
    expect(await friendsOf(inviter.user.id)).toEqual([user.id]);
    expect((await inviteEvents(user.id)).map((event) => [event.name, event.props])).toEqual([
      ['invite_joined', { inviter_id: inviter.user.id }],
    ]);
    expect(sent().map((call) => call.payload.text)).toEqual([inviteText(inviter.user.firstName)]);

    // Repeating the link changes nothing.
    await deliver(text(tgId, `/start ${inviter.user.inviteCode}`));
    expect(await friendsOf(user.id)).toEqual([inviter.user.id]);
    expect(await inviteEvents(user.id)).toHaveLength(1);
  });

  it('/start with the own or an unknown code is a plain greeting', async () => {
    const tgId = newTgId();
    const { user } = await signIn(tgId);
    await deliver(text(tgId, `/start ${user.inviteCode}`));
    await deliver(text(tgId, '/start NoSuchCode'));
    expect(await friendsOf(user.id)).toEqual([]);
    expect(sent().map((call) => call.payload.text)).toEqual([START_TEXT, START_TEXT]);
  });

  it('an onboarded user gets the friendship but no invited_by', async () => {
    const inviter = await signIn(newTgId());
    const tgId = newTgId();
    const { user } = await signIn(tgId);
    await database.db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));

    await deliver(text(tgId, `/start ${inviter.user.inviteCode}`));
    expect(await friendsOf(user.id)).toEqual([inviter.user.id]);
    expect((await userByTgId(tgId))?.invitedBy).toBeNull();
    expect(await inviteEvents(user.id)).toEqual([]);
  });

  it('a user created by /start is still invited when the app opens by a link', async () => {
    const inviter = await signIn(newTgId());
    const tgId = newTgId();
    await deliver(text(tgId, '/start'));

    const { user } = await signIn(tgId, inviter.user.inviteCode);
    expect((await userByTgId(tgId))?.invitedBy).toBe(inviter.user.id);
    expect(await inviteEvents(user.id)).toHaveLength(1);
  });

  it('done: the second account by the link appears in the leaderboard of the first', async () => {
    const firstTgId = newTgId();
    const first = await signIn(firstTgId);
    const second = await signIn(newTgId(), first.user.inviteCode);

    const response = await app.inject({
      method: 'GET',
      url: '/api/friends/leaderboard?period=all',
      headers: { authorization: initData(firstTgId) },
    });
    expect(response.statusCode).toBe(200);
    const { entries } = leaderboardResponseSchema.parse(response.json());
    expect(entries.map((entry) => entry.userId).sort()).toEqual(
      [first.user.id, second.user.id].sort(),
    );
  });

  it('answers /terms, /paysupport and any other text', async () => {
    const tgId = newTgId();
    await deliver(text(tgId, '/terms'));
    await deliver(text(tgId, '/paysupport'));
    await deliver(text(tgId, 'привет'));
    expect(sent().map((call) => [call.payload.text, call.payload.reply_markup])).toEqual([
      ['Условия использования: https://example.com/terms', undefined],
      ['По вопросам оплаты напишите @help — ответим и при необходимости вернём Stars.', undefined],
      [START_TEXT, { inline_keyboard: [[{ text: 'Открыть', web_app: { url: WEBAPP_URL } }]] }],
    ]);
    // Other commands and texts do not create users.
    expect(await userByTgId(tgId)).toBeUndefined();
  });

  it('tracks bot_can_write: write access, blocking and unblocking', async () => {
    const tgId = newTgId();
    await signIn(tgId);

    await deliver(message(tgId, { write_access_allowed: { from_request: true } }));
    expect((await userByTgId(tgId))?.botCanWrite).toBe(true);

    await deliver(chatMember(tgId, 'kicked'));
    expect((await userByTgId(tgId))?.botCanWrite).toBe(false);

    await deliver(chatMember(tgId, 'member'));
    expect((await userByTgId(tgId))?.botCanWrite).toBe(true);

    // An unknown user is ignored.
    const stranger = newTgId();
    await deliver(chatMember(stranger, 'member'));
    expect(await userByTgId(stranger)).toBeUndefined();
    expect(calls.filter((call) => call.method === 'sendMessage')).toEqual([]);
  });

  it('resets bot_can_write when the reply is refused with 403', async () => {
    const tgId = newTgId();
    await signIn(tgId);
    await deliver(message(tgId, { write_access_allowed: { from_request: true } }));

    sendError = 403;
    await deliver(text(tgId, 'привет'));
    expect((await userByTgId(tgId))?.botCanWrite).toBe(false);
  });

  it('answers 500 on other Bot API errors so Telegram retries', async () => {
    sendError = 500;
    const response = await post(text(newTgId(), 'привет'));
    expect(response.statusCode).toBe(500);
  });
});
