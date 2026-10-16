import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { authResponseSchema, type AuthResponse } from '@tma80/shared';

import { buildApp } from '../app.ts';
import { signInitData } from '../auth/initData.ts';
import { requireUser } from '../auth/plugin.ts';
import { connect, type Database } from '../db/client.ts';
import { events, friendships, subscriptions, users } from '../db/schema.ts';

/**
 * `POST /api/auth` against a real database: `npm run test:db` (sets `TEST_DATABASE=1`,
 * `DATABASE_URL` from `.env` or the environment) after `npm run db:migrate`. Skipped in
 * `npm run check`. Users get random `tg_id`s and are deleted afterwards.
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('POST /api/auth', () => {
  const TOKEN = '42:test-auth-token';
  let database: Database;
  let app: ReturnType<typeof buildApp>;
  const base = 8_000_000_000 + Math.floor(Math.random() * 1_000_000) * 100;
  let next = 0;
  const tgIds: number[] = [];

  const newTgId = () => {
    next += 1;
    const id = base + next;
    tgIds.push(id);
    return id;
  };

  const initData = (
    tgId: number,
    extra: { startParam?: string; user?: Record<string, unknown>; authDate?: number } = {},
  ) =>
    signInitData(
      {
        auth_date: String(extra.authDate ?? Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: tgId, first_name: `Тест ${String(tgId)}`, ...extra.user }),
        ...(extra.startParam === undefined ? {} : { start_param: extra.startParam }),
      },
      TOKEN,
    );

  const auth = async (raw: string) =>
    app.inject({ method: 'POST', url: '/api/auth', headers: { authorization: `tma ${raw}` } });

  const signIn = async (raw: string): Promise<AuthResponse> => {
    const response = await auth(raw);
    expect(response.statusCode).toBe(200);
    return authResponseSchema.parse(response.json());
  };

  const friendsOf = async (userId: string) =>
    (
      await database.db
        .select({ friendId: friendships.friendId })
        .from(friendships)
        .where(inArray(friendships.userId, [userId]))
    ).map((row) => row.friendId);

  const userRow = async (userId: string) => {
    const [row] = await database.db
      .select()
      .from(users)
      .where(inArray(users.id, [userId]));
    if (!row) throw new Error('no user');
    return row;
  };

  const inviteEvents = async (userId: string) =>
    database.db
      .select()
      .from(events)
      .where(inArray(events.userId, [userId]));

  beforeAll(() => {
    database = connect();
    app = buildApp({ db: database.db, botToken: TOKEN });
    // A route with the default `auth: 'user'`, as the other endpoints will be.
    app.get('/api/test-whoami', (request) => ({ id: requireUser(request).id }));
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

  it('creates a new user with defaults and asks for onboarding', async () => {
    const tgId = newTgId();
    const body = await signIn(
      initData(tgId, {
        user: { username: 'newbie', photo_url: 'https://t.me/i/userpic/1.jpg', last_name: 'X' },
      }),
    );
    expect(body.needsOnboarding).toBe(true);
    expect(body.subscription).toEqual({ active: false, plan: null, expiresAt: null });
    expect(body.user).toMatchObject({
      tgId,
      firstName: `Тест ${String(tgId)}`,
      username: 'newbie',
      photoUrl: 'https://t.me/i/userpic/1.jpg',
      household: null,
      weekdayMinutes: null,
      exclusions: [],
      customExclusions: [],
      timezone: 'Europe/Moscow',
      reminderEnabled: false,
      reminderTime: '18:00',
      botCanWrite: false,
    });
    expect(body.user.inviteCode).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('refreshes Telegram fields of an existing user and keeps the rest', async () => {
    const tgId = newTgId();
    const first = await signIn(
      initData(tgId, { user: { username: 'old', allows_write_to_pm: true } }),
    );
    expect(first.user.botCanWrite).toBe(true);

    const second = await signIn(
      initData(tgId, { user: { first_name: 'Новое имя', allows_write_to_pm: false } }),
    );
    expect(second.user).toMatchObject({
      id: first.user.id,
      inviteCode: first.user.inviteCode,
      firstName: 'Новое имя',
      username: null,
      // `allows_write_to_pm` only raises the flag.
      botCanWrite: true,
    });
  });

  it('reports the onboarding and the subscription from the database', async () => {
    const tgId = newTgId();
    const { user } = await signIn(initData(tgId));
    const expiresAt = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    await database.db
      .update(users)
      .set({ onboardedAt: new Date() })
      .where(inArray(users.id, [user.id]));
    await database.db.insert(subscriptions).values({
      userId: user.id,
      plan: 'month',
      starsAmount: 150,
      telegramPaymentChargeId: `test-auth-${String(tgId)}`,
      startsAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      expiresAt,
    });
    const body = await signIn(initData(tgId));
    expect(body.needsOnboarding).toBe(false);
    expect(body.subscription).toEqual({
      active: true,
      plan: 'month',
      expiresAt: expiresAt.toISOString(),
    });
  });

  it('befriends a new user with the inviter and records invited_by and invite_joined', async () => {
    const inviter = await signIn(initData(newTgId()));
    const invitee = await signIn(initData(newTgId(), { startParam: inviter.user.inviteCode }));

    expect(await friendsOf(invitee.user.id)).toEqual([inviter.user.id]);
    expect(await friendsOf(inviter.user.id)).toEqual([invitee.user.id]);
    expect((await userRow(invitee.user.id)).invitedBy).toBe(inviter.user.id);
    const joined = await inviteEvents(invitee.user.id);
    expect(joined.map((event) => [event.name, event.props])).toEqual([
      ['invite_joined', { inviter_id: inviter.user.id }],
    ]);
  });

  it('befriends an existing user without invited_by and invite_joined', async () => {
    const inviter = await signIn(initData(newTgId()));
    const existingTgId = newTgId();
    const existing = await signIn(initData(existingTgId));

    const again = await signIn(initData(existingTgId, { startParam: inviter.user.inviteCode }));
    expect(again.user.id).toBe(existing.user.id);
    expect(await friendsOf(existing.user.id)).toEqual([inviter.user.id]);
    expect(await friendsOf(inviter.user.id)).toEqual([existing.user.id]);
    expect((await userRow(existing.user.id)).invitedBy).toBeNull();
    expect(await inviteEvents(existing.user.id)).toEqual([]);

    // Opening the same link again changes nothing.
    await signIn(initData(existingTgId, { startParam: inviter.user.inviteCode }));
    expect(await friendsOf(existing.user.id)).toEqual([inviter.user.id]);
  });

  it('ignores the own code and an unknown code', async () => {
    const tgId = newTgId();
    const { user } = await signIn(initData(tgId));
    await signIn(initData(tgId, { startParam: user.inviteCode }));
    const stranger = await signIn(initData(newTgId(), { startParam: 'NoSuchCode' }));

    expect(await friendsOf(user.id)).toEqual([]);
    expect(await friendsOf(stranger.user.id)).toEqual([]);
    expect((await userRow(stranger.user.id)).invitedBy).toBeNull();
    expect(await inviteEvents(stranger.user.id)).toEqual([]);
  });

  it('rejects forged and outdated init data without touching the database', async () => {
    const tgId = newTgId();
    const forged = new URLSearchParams(initData(newTgId()));
    forged.set('user', JSON.stringify({ id: tgId, first_name: 'Взлом' }));
    const outdated = initData(tgId, { authDate: Math.floor(Date.now() / 1000) - 25 * 3600 });

    for (const raw of [forged.toString(), outdated]) {
      const response = await auth(raw);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'unauthorized' } });
    }
    const rows = await database.db
      .select()
      .from(users)
      .where(inArray(users.tgId, [tgId]));
    expect(rows).toEqual([]);
  });

  it('lets other endpoints in only for users created by POST /auth', async () => {
    const tgId = newTgId();
    const whoami = (raw: string) =>
      app.inject({
        method: 'GET',
        url: '/api/test-whoami',
        headers: { authorization: `tma ${raw}` },
      });

    const unknown = await whoami(initData(tgId));
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toMatchObject({ error: { code: 'unauthorized' } });

    const { user } = await signIn(initData(tgId));
    const known = await whoami(initData(tgId));
    expect(known.statusCode).toBe(200);
    expect(known.json()).toEqual({ id: user.id });

    expect((await app.inject({ method: 'GET', url: '/api/test-whoami' })).statusCode).toBe(401);
  });
});
