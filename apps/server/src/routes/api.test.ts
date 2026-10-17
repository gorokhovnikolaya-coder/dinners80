import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { asc, eq, inArray } from 'drizzle-orm';
import type { Transformer } from 'grammy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  COOK_PHOTO_FIELD,
  COOK_PHOTO_MAX_BYTES,
  COOK_PHOTO_UPLOADS_PER_DAY_LIMIT,
  COOKS_PER_DAY_LIMIT,
  FREE_COUNTRIES_LIMIT,
  addShoppingResponseSchema,
  apiErrorSchema,
  authResponseSchema,
  clearShoppingResponseSchema,
  createCookResponseSchema,
  dishResponseSchema,
  feedResponseSchema,
  homeResponseSchema,
  leaderboardResponseSchema,
  mapResponseSchema,
  meResponseSchema,
  SHARE_CARD_FIELD,
  SHARE_CARD_MAX_BYTES,
  addCookPhotoResponseSchema,
  paywallErrorSchema,
  shoppingItemSchema,
  shoppingResponseSchema,
  uploadCookPhotoResponseSchema,
  shareStampResponseSchema,
  uploadShareCardResponseSchema,
  type UserProfile,
} from '@tma80/shared';

import { buildApp } from '../app.ts';
import { signInitData } from '../auth/initData.ts';
import { connect, type Database } from '../db/client.ts';
import { cooks, countries, dishes, friendships, subscriptions, users } from '../db/schema.ts';
import { secureLinkHash } from '../media/signedLink.ts';

/**
 * The API endpoints against the local database with the seeded content: `npm run test:db` after
 * `npm run db:reset`. Skipped in `npm run check`. Users get random `tg_id`s and are deleted
 * afterwards (their cooks, friendships and shopping items go by cascade).
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('API endpoints', () => {
  const TOKEN = '42:test-api-token';
  const MEDIA_KEY = 'test-media-key-0123456789abcdefghijklmnop';
  let mediaDir = '';
  const DAY_MS = 24 * 60 * 60 * 1000;
  let database: Database;
  let app: ReturnType<typeof buildApp>;
  const base = 9_000_000_000 + Math.floor(Math.random() * 1_000_000) * 100;
  let next = 0;
  const tgIds: number[] = [];
  /** Bot API calls of the share route, intercepted instead of the network. */
  let botCalls: { method: string; payload: Record<string, unknown> }[] = [];
  let botFailure: string | null = null;
  const transformer: Transformer = (_prev, method, payload) => {
    botCalls.push({ method, payload });
    if (botFailure !== null)
      return Promise.resolve({ ok: false, error_code: 400, description: botFailure });
    return Promise.resolve({
      ok: true,
      result: { id: `prepared-${String(botCalls.length)}`, expiration_date: 0 } as never,
    });
  };
  const SHARE_LINKS = {
    webAppUrl: 'https://tma80.example/',
    miniAppLink: 'https://t.me/tma80_bot/app',
  };
  /** Published dishes by country, in `sort` order of the countries. */
  let dishesByCountry: { countryId: string; dishIds: string[] }[] = [];

  interface TestUser {
    profile: UserProfile;
    headers: { authorization: string };
  }

  const newUser = async (firstName = 'Тест'): Promise<TestUser> => {
    next += 1;
    const tgId = base + next;
    tgIds.push(tgId);
    const raw = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: tgId, first_name: firstName }),
      },
      TOKEN,
    );
    const headers = { authorization: `tma ${raw}` };
    const response = await app.inject({ method: 'POST', url: '/api/auth', headers });
    expect(response.statusCode).toBe(200);
    return { profile: authResponseSchema.parse(response.json()).user, headers };
  };

  const call = (
    user: TestUser,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api${url}`,
      headers: user.headers,
      ...(payload === undefined ? {} : { payload }),
    });

  /** A JPEG-looking file of `size` bytes. */
  const jpeg = (size = 1000) => {
    const data = Buffer.alloc(size, 7);
    data.set([0xff, 0xd8, 0xff, 0xe0]);
    return data;
  };

  /** `multipart/form-data` with one file, as the client's `FormData` sends it. */
  const upload = (
    user: TestUser | null,
    url: string,
    field: string,
    data: Buffer,
    type = 'image/jpeg',
  ) => {
    const boundary = `----tma80${randomUUID()}`;
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="photo.jpg"\r\n` +
          `Content-Type: ${type}\r\n\r\n`,
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return app.inject({
      method: 'POST',
      url: `/api${url}`,
      headers: {
        ...(user?.headers ?? {}),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
  };

  /** Uploads a cook photo of the user; returns its `photoPath`. */
  const uploadPhoto = async (user: TestUser) => {
    const response = await upload(user, '/uploads/cook-photo', COOK_PHOTO_FIELD, jpeg());
    expect(response.statusCode).toBe(201);
    return uploadCookPhotoResponseSchema.parse(response.json()).photoPath;
  };

  const errorCode = (response: { json: () => unknown }) =>
    apiErrorSchema.parse(response.json()).error.code;

  /** Records one cook of the dish of the `n`-th country (1-based) through the API; its id. */
  const cookOnce = async (user: TestUser, n = 1) => {
    const dishId = dishesByCountry[n - 1]?.dishIds[0] ?? '';
    const response = await call(user, 'POST', '/cooks', { dishId });
    expect(response.statusCode).toBe(201);
    return createCookResponseSchema.parse(response.json()).cookId;
  };

  /** Cooks of the first `n` countries (one dish each), `daysAgo` days ago. */
  const addCooks = async (user: TestUser, n: number, daysAgo = 30) => {
    const rows = dishesByCountry.slice(0, n).map(({ countryId, dishIds }) => ({
      userId: user.profile.id,
      dishId: dishIds[0] ?? '',
      countryId,
      createdAt: new Date(Date.now() - daysAgo * DAY_MS),
    }));
    if (rows.length > 0) await database.db.insert(cooks).values(rows);
  };

  const befriend = async (a: TestUser, b: TestUser) => {
    await database.db.insert(friendships).values([
      { userId: a.profile.id, friendId: b.profile.id },
      { userId: b.profile.id, friendId: a.profile.id },
    ]);
  };

  beforeAll(async () => {
    database = connect();
    mediaDir = await mkdtemp(join(tmpdir(), 'tma80-api-media-'));
    app = buildApp({
      db: database.db,
      botToken: TOKEN,
      mediaUrl: '/media',
      mediaDir,
      mediaSigningKey: MEDIA_KEY,
      apiTransformer: transformer,
      shareLinks: SHARE_LINKS,
    });
    const rows = await database.db
      .select({ countryId: dishes.countryId, dishId: dishes.id })
      .from(dishes)
      .innerJoin(countries, eq(countries.id, dishes.countryId))
      .where(eq(countries.isPublished, true))
      .orderBy(asc(countries.sort), asc(dishes.id));
    for (const row of rows) {
      const group = dishesByCountry.find((item) => item.countryId === row.countryId);
      if (group) group.dishIds.push(row.dishId);
      else dishesByCountry.push({ countryId: row.countryId, dishIds: [row.dishId] });
    }
  });

  afterAll(async () => {
    const created = await database.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.tgId, tgIds));
    const ids = created.map((row) => row.id);
    if (ids.length > 0) await database.db.delete(users).where(inArray(users.id, ids));
    dishesByCountry = [];
    await app.close();
    await database.pool.end();
    await rm(mediaDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    botCalls = [];
    botFailure = null;
  });

  describe('PATCH /me', () => {
    it('saves the answers normalised and finishes the onboarding once both are known', async () => {
      const user = await newUser();
      const first = await call(user, 'PATCH', '/me', { household: 'family' });
      expect(first.statusCode).toBe(200);
      expect(meResponseSchema.parse(first.json()).needsOnboarding).toBe(true);

      const second = meResponseSchema.parse(
        (
          await call(user, 'PATCH', '/me', {
            weekdayMinutes: 30,
            exclusions: ['spicy', 'meat'],
            customExclusions: ['  Кинза '],
            timezone: 'Asia/Tokyo',
            reminderEnabled: true,
            reminderTime: '19:30',
          })
        ).json(),
      );
      expect(second.needsOnboarding).toBe(false);
      expect(second.user).toMatchObject({
        household: 'family',
        weekdayMinutes: 30,
        exclusions: ['meat', 'spicy'],
        customExclusions: ['кинза'],
        timezone: 'Asia/Tokyo',
        reminderEnabled: true,
        reminderTime: '19:30',
      });
    });

    it('rejects an invalid or empty update', async () => {
      const user = await newUser();
      for (const payload of [{}, { weekdayMinutes: 25 }, { timezone: 'Mars/Base' }, { x: 1 }]) {
        const response = await call(user, 'PATCH', '/me', payload);
        expect(response.statusCode).toBe(400);
        expect(errorCode(response)).toBe('validation');
      }
    });
  });

  describe('GET /home and GET /map', () => {
    it('suggests three dishes with the counters of published content', async () => {
      const user = await newUser();
      await call(user, 'PATCH', '/me', { household: 'couple', weekdayMinutes: 45 });
      await addCooks(user, 2);

      const response = await call(user, 'GET', '/home?mode=weekend&page=0');
      expect(response.statusCode).toBe(200);
      const home = homeResponseSchema.parse(response.json());
      expect(home.suggestions).toHaveLength(3);
      expect(home.countriesCount).toBe(2);
      expect(home.countriesTotal).toBe(dishesByCountry.length);
      expect(home.dishesCount).toBe(2);
      expect(home.suggestions[0]?.imageUrl).toMatch(/^\/media\/content\/[a-z]+\/[a-z0-9-]+\.webp$/);
      // New countries come first.
      expect(home.suggestions[0]?.label).toEqual({ kind: 'newCountry' });

      const invalid = await call(user, 'GET', '/home?mode=night');
      expect(invalid.statusCode).toBe(400);
    });

    it('locks the new countries of a free user with all free countries passed', async () => {
      const user = await newUser();
      await call(user, 'PATCH', '/me', { household: 'solo', weekdayMinutes: 45 });
      await addCooks(user, FREE_COUNTRIES_LIMIT);

      const map = mapResponseSchema.parse((await call(user, 'GET', '/map')).json());
      const all = map.continents.flatMap((continent) => continent.countries);
      expect(map.countriesCount).toBe(FREE_COUNTRIES_LIMIT);
      expect(all).toHaveLength(dishesByCountry.length);
      expect(all.filter((country) => country.passed)).toHaveLength(FREE_COUNTRIES_LIMIT);
      expect(all.filter((country) => country.locked)).toHaveLength(
        dishesByCountry.length - FREE_COUNTRIES_LIMIT,
      );

      const home = homeResponseSchema.parse(
        (await call(user, 'GET', '/home?mode=weekend&page=0')).json(),
      );
      expect(home.suggestions.map((card) => card.locked)).toEqual([false, false, true]);
    });
  });

  describe('GET /dishes/:id', () => {
    it('recalculates the amounts for the servings, by «who eats» by default', async () => {
      const user = await newUser();
      await call(user, 'PATCH', '/me', { household: 'family', weekdayMinutes: 30 });

      const byDefault = dishResponseSchema.parse(
        (await call(user, 'GET', '/dishes/it-carbonara')).json(),
      );
      expect(byDefault.servings).toBe(4);
      expect(byDefault.baseServings).toBe(2);
      const spaghetti = byDefault.ingredients.find((item) => item.key === 'spaghetti');
      expect(spaghetti).toMatchObject({ baseAmount: 200, amount: 400, unit: 'g' });
      expect(byDefault.ingredients.find((item) => item.key === 'salt')).toMatchObject({
        amount: null,
        unit: null,
      });
      expect(byDefault.steps[0]?.n).toBe(1);
      expect(byDefault.label).toEqual({ kind: 'newCountry' });

      const one = dishResponseSchema.parse(
        (await call(user, 'GET', '/dishes/it-carbonara?servings=1')).json(),
      );
      expect(one.servings).toBe(1);
      expect(one.ingredients.find((item) => item.key === 'spaghetti')?.amount).toBe(100);
    });

    it('answers 404 for an unknown dish', async () => {
      const user = await newUser();
      const response = await call(user, 'GET', '/dishes/xx-nothing');
      expect(response.statusCode).toBe(404);
      expect(errorCode(response)).toBe('not_found');
    });

    it('closes a new country with 403 paywall and only the preview', async () => {
      const user = await newUser();
      await addCooks(user, FREE_COUNTRIES_LIMIT);
      const closed = dishesByCountry[FREE_COUNTRIES_LIMIT]?.dishIds[0] ?? '';
      const open = dishesByCountry[0]?.dishIds[1] ?? '';

      const response = await call(user, 'GET', `/dishes/${closed}`);
      expect(response.statusCode).toBe(403);
      const body = paywallErrorSchema.parse(response.json());
      expect(body.error.preview.dishId).toBe(closed);
      expect(response.json()).not.toHaveProperty('ingredients');
      expect((await call(user, 'GET', `/dishes/${open}`)).statusCode).toBe(200);

      // An active subscription opens every country.
      await database.db.insert(subscriptions).values({
        userId: user.profile.id,
        plan: 'month',
        starsAmount: 150,
        telegramPaymentChargeId: `test-api-${user.profile.id}`,
        startsAt: new Date(Date.now() - DAY_MS),
        expiresAt: new Date(Date.now() + 29 * DAY_MS),
      });
      expect((await call(user, 'GET', `/dishes/${closed}`)).statusCode).toBe(200);
    });
  });

  describe('POST /cooks', () => {
    it('stamps a new country, counts repeats and names the friend overtaken', async () => {
      const user = await newUser('Я');
      const friend = await newUser('Жанна');
      await befriend(user, friend);
      await addCooks(friend, 1);
      await addCooks(user, 1);
      const dishId = dishesByCountry[1]?.dishIds[0] ?? '';

      const first = await call(user, 'POST', '/cooks', { dishId });
      expect(first.statusCode).toBe(201);
      expect(createCookResponseSchema.parse(first.json())).toMatchObject({
        newCountry: true,
        countriesCount: 2,
        countriesTotal: dishesByCountry.length,
        dishesCount: 2,
        overtook: 'Жанна',
      });

      const again = createCookResponseSchema.parse(
        (await call(user, 'POST', '/cooks', { dishId, photoPath: null })).json(),
      );
      expect(again).toMatchObject({
        newCountry: false,
        countriesCount: 2,
        dishesCount: 3,
        overtook: null,
      });

      const card = dishResponseSchema.parse((await call(user, 'GET', `/dishes/${dishId}`)).json());
      expect(card.label).toEqual({ kind: 'cookedBefore' });
    });

    it('accepts only an uploaded photo from the own folder and stores it without the folder name', async () => {
      const user = await newUser();
      const other = await newUser();
      const dishId = dishesByCountry[0]?.dishIds[0] ?? '';
      const foreignPhoto = await uploadPhoto(other);
      const foreign = await call(user, 'POST', '/cooks', { dishId, photoPath: foreignPhoto });
      expect(foreign.statusCode).toBe(400);
      expect(errorCode(foreign)).toBe('validation');
      // The own folder, but nothing was uploaded.
      const missing = await call(user, 'POST', '/cooks', {
        dishId,
        photoPath: `cooks/${user.profile.id}/${randomUUID()}.jpg`,
      });
      expect(missing.statusCode).toBe(400);

      const photoPath = await uploadPhoto(user);
      const own = await call(user, 'POST', '/cooks', { dishId, photoPath });
      expect(own.statusCode).toBe(201);
      const [row] = await database.db
        .select({ photoPath: cooks.photoPath })
        .from(cooks)
        .where(eq(cooks.userId, user.profile.id));
      expect(row?.photoPath).toBe(photoPath.slice('cooks/'.length));
    });

    it('checks the access and the daily limit on the server', async () => {
      const user = await newUser();
      await addCooks(user, FREE_COUNTRIES_LIMIT);
      const closed = dishesByCountry[FREE_COUNTRIES_LIMIT]?.dishIds[0] ?? '';
      const paywall = await call(user, 'POST', '/cooks', { dishId: closed });
      expect(paywall.statusCode).toBe(403);
      expect(errorCode(paywall)).toBe('paywall');

      const dishId = dishesByCountry[0]?.dishIds[0] ?? '';
      await database.db.insert(cooks).values(
        Array.from({ length: COOKS_PER_DAY_LIMIT - 1 }, () => ({
          userId: user.profile.id,
          dishId,
          countryId: dishesByCountry[0]?.countryId ?? '',
        })),
      );
      // Two at once: the advisory lock lets exactly one of them in.
      const responses = await Promise.all([
        call(user, 'POST', '/cooks', { dishId }),
        call(user, 'POST', '/cooks', { dishId }),
      ]);
      expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 429]);
      const limited = responses.find((response) => response.statusCode === 429);
      expect(limited && errorCode(limited)).toBe('rate_limited');
    });

    it('rejects an unknown dish', async () => {
      const user = await newUser();
      expect((await call(user, 'POST', '/cooks', { dishId: 'xx-nothing' })).statusCode).toBe(404);
      expect((await call(user, 'POST', '/cooks', {})).statusCode).toBe(400);
    });
  });

  describe('friends', () => {
    it('ranks the user with the friends and shows their first stamps', async () => {
      const user = await newUser('Я');
      const friend = await newUser('Маша');
      const stranger = await newUser('Чужой');
      await befriend(user, friend);
      await addCooks(friend, 3, 2);
      await addCooks(stranger, 5, 2);
      // A repeat is not a stamp.
      await database.db.insert(cooks).values({
        userId: friend.profile.id,
        dishId: dishesByCountry[0]?.dishIds[1] ?? '',
        countryId: dishesByCountry[0]?.countryId ?? '',
      });

      const board = leaderboardResponseSchema.parse(
        (await call(user, 'GET', '/friends/leaderboard?period=all')).json(),
      );
      expect(board.entries.map((entry) => [entry.firstName, entry.isMe, entry.place])).toEqual([
        ['Маша', false, 1],
        ['Я', true, 2],
      ]);
      expect(board.entries[0]).toMatchObject({ countries: 3, dishes: 4 });
      expect((await call(user, 'GET', '/friends/leaderboard?period=year')).statusCode).toBe(400);

      const feed = feedResponseSchema.parse((await call(user, 'GET', '/friends/feed')).json());
      expect(feed.items).toHaveLength(3);
      expect(feed.items.every((item) => item.firstName === 'Маша')).toBe(true);
      expect(feed.items.every((item) => item.photoUrl === null)).toBe(true);
    });

    it('signs links to the photos of friends for an hour, never to the photos of strangers', async () => {
      const user = await newUser('Я');
      const friend = await newUser('Маша');
      const stranger = await newUser('Чужой');
      await befriend(user, friend);
      const dishId = dishesByCountry[0]?.dishIds[0] ?? '';
      const friendPhoto = await uploadPhoto(friend);
      const strangerPhoto = await uploadPhoto(stranger);
      expect(
        (await call(friend, 'POST', '/cooks', { dishId, photoPath: friendPhoto })).statusCode,
      ).toBe(201);
      expect(
        (await call(stranger, 'POST', '/cooks', { dishId, photoPath: strangerPhoto })).statusCode,
      ).toBe(201);

      const before = Math.floor(Date.now() / 1000);
      const feed = feedResponseSchema.parse((await call(user, 'GET', '/friends/feed')).json());
      expect(feed.items.map((item) => item.firstName)).toEqual(['Маша']);
      const url = new URL(feed.items[0]?.photoUrl ?? '', 'https://app.example');
      expect(url.pathname).toBe(`/media/${friendPhoto}`);
      const expires = Number(url.searchParams.get('expires'));
      expect(expires - before).toBeGreaterThanOrEqual(3600);
      expect(expires - before).toBeLessThanOrEqual(3601);
      expect(url.searchParams.get('md5')).toBe(secureLinkHash(url.pathname, expires, MEDIA_KEY));
      expect(JSON.stringify(feed)).not.toContain(strangerPhoto);
    });
  });

  describe('uploads', () => {
    it('stores a cook photo in the private folder of the user', async () => {
      const user = await newUser();
      const photoPath = await uploadPhoto(user);
      expect(photoPath).toMatch(new RegExp(`^cooks/${user.profile.id}/[0-9a-f-]{36}\\.jpg$`));
      expect((await stat(join(mediaDir, photoPath))).size).toBe(1000);
    });

    it('accepts only one JPEG of at most 500 KB in the «photo» field from a known user', async () => {
      const user = await newUser();
      const url = '/uploads/cook-photo';
      const max = await upload(user, url, COOK_PHOTO_FIELD, jpeg(COOK_PHOTO_MAX_BYTES));
      expect(max.statusCode).toBe(201);
      const large = await upload(user, url, COOK_PHOTO_FIELD, jpeg(COOK_PHOTO_MAX_BYTES + 1));
      expect(large.statusCode).toBe(413);
      expect(errorCode(large)).toBe('validation');
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect((await upload(user, url, COOK_PHOTO_FIELD, png, 'image/jpeg')).statusCode).toBe(400);
      expect((await upload(user, url, 'file', jpeg())).statusCode).toBe(400);
      expect((await call(user, 'POST', url, { photo: 'x' })).statusCode).toBe(400);
      expect((await upload(null, url, COOK_PHOTO_FIELD, jpeg())).statusCode).toBe(401);
    });

    it('limits cook photos of a user per day, parallel uploads included', async () => {
      const user = await newUser();
      const other = await newUser();
      const responses = await Promise.all(
        Array.from({ length: COOK_PHOTO_UPLOADS_PER_DAY_LIMIT + 2 }, () =>
          upload(user, '/uploads/cook-photo', COOK_PHOTO_FIELD, jpeg()),
        ),
      );
      const codes = responses.map((response) => response.statusCode);
      expect(codes.filter((code) => code === 201)).toHaveLength(COOK_PHOTO_UPLOADS_PER_DAY_LIMIT);
      const limited = responses.filter((response) => response.statusCode === 429);
      expect(limited).toHaveLength(2);
      expect(limited.map(errorCode)).toEqual(['rate_limited', 'rate_limited']);
      // Another user is not limited.
      await uploadPhoto(other);
    });

    it('stores one share card per own cook in the public folder', async () => {
      const user = await newUser();
      const other = await newUser();
      const cookId = await cookOnce(user);
      const url = `/uploads/share-card?cookId=${cookId}`;
      const response = await upload(user, url, SHARE_CARD_FIELD, jpeg(SHARE_CARD_MAX_BYTES));
      expect(response.statusCode).toBe(201);
      const card = uploadShareCardResponseSchema.parse(response.json()).url;
      expect(card).toMatch(/^\/media\/share\/[0-9a-f-]{36}\.jpg$/);
      const file = join(mediaDir, card.slice('/media/'.length));
      expect((await stat(file)).size).toBe(SHARE_CARD_MAX_BYTES);

      // A repeated upload for the same cook gets the same card, no new file.
      const again = await upload(user, url, SHARE_CARD_FIELD, jpeg(500));
      expect(again.statusCode).toBe(200);
      expect(uploadShareCardResponseSchema.parse(again.json()).url).toBe(card);
      expect((await readdir(join(mediaDir, 'share'))).filter((name) => card.endsWith(name))).toHaveLength(1);

      // Parallel uploads of another cook store one card.
      const second = await cookOnce(user);
      const parallel = await Promise.all(
        [1, 2, 3].map(() =>
          upload(user, `/uploads/share-card?cookId=${second}`, SHARE_CARD_FIELD, jpeg()),
        ),
      );
      const urls = new Set(
        parallel.map((item) => uploadShareCardResponseSchema.parse(item.json()).url),
      );
      expect(urls.size).toBe(1);

      // The card was deleted (the worker, after 30 days): a new upload replaces it.
      await rm(file);
      const replaced = await upload(user, url, SHARE_CARD_FIELD, jpeg());
      expect(replaced.statusCode).toBe(201);
      expect(uploadShareCardResponseSchema.parse(replaced.json()).url).not.toBe(card);

      expect((await upload(other, url, SHARE_CARD_FIELD, jpeg())).statusCode).toBe(404);
      const noCook = await upload(user, '/uploads/share-card', SHARE_CARD_FIELD, jpeg());
      expect(noCook.statusCode).toBe(400);
      const large = await upload(user, url, SHARE_CARD_FIELD, jpeg(SHARE_CARD_MAX_BYTES + 1));
      expect(large.statusCode).toBe(413);
      expect((await upload(user, url, COOK_PHOTO_FIELD, jpeg())).statusCode).toBe(400);
      expect((await upload(null, url, SHARE_CARD_FIELD, jpeg())).statusCode).toBe(401);
    });
  });

  describe('POST /share/stamp/:cookId', () => {
    const shareCard = async (user: TestUser, cookId: string) => {
      const response = await upload(
        user,
        `/uploads/share-card?cookId=${cookId}`,
        SHARE_CARD_FIELD,
        jpeg(),
      );
      return uploadShareCardResponseSchema.parse(response.json()).url;
    };

    it('prepares a photo message with the card and the invite link of the user', async () => {
      const user = await newUser();
      await addCooks(user, 2);
      const cookId = await cookOnce(user, 3);
      const card = await shareCard(user, cookId);
      const response = await call(user, 'POST', `/share/stamp/${cookId}`);
      expect(response.statusCode).toBe(200);
      expect(shareStampResponseSchema.parse(response.json()).preparedMessageId).toBe('prepared-1');
      expect(botCalls).toHaveLength(1);
      const [prepared] = botCalls;
      expect(prepared?.method).toBe('savePreparedInlineMessage');
      const photoUrl = `https://tma80.example${card}`;
      expect(prepared?.payload).toMatchObject({
        user_id: user.profile.tgId,
        allow_user_chats: true,
        allow_group_chats: true,
        result: {
          type: 'photo',
          id: cookId,
          photo_url: photoUrl,
          thumbnail_url: photoUrl,
          photo_width: 1080,
          photo_height: 1920,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Открыть',
                  url: `https://t.me/tma80_bot/app?startapp=${user.profile.inviteCode}`,
                },
              ],
            ],
          },
        },
      });
      expect(prepared?.payload).not.toHaveProperty('allow_channel_chats');
      const result = prepared?.payload.result as { caption: string };
      expect(result.caption).toMatch(/ в паспорте — уже 3 из \d+ стран! /);

      // A repeated dish of the country: no stamp in the caption.
      const repeat = await cookOnce(user, 3);
      await shareCard(user, repeat);
      expect((await call(user, 'POST', `/share/stamp/${repeat}`)).statusCode).toBe(200);
      const repeated = botCalls[1]?.payload.result as { caption: string };
      expect(repeated.caption).toMatch(/ — блюдо засчитано, уже 3 из \d+ стран! /);
    });

    it('needs the own cook with an uploaded card', async () => {
      const user = await newUser();
      const other = await newUser();
      const cookId = await cookOnce(user);
      expect((await call(user, 'POST', `/share/stamp/${cookId}`)).statusCode).toBe(400);
      await shareCard(user, cookId);
      const foreign = await call(other, 'POST', `/share/stamp/${cookId}`);
      expect(foreign.statusCode).toBe(404);
      expect((await call(user, 'POST', '/share/stamp/not-a-uuid')).statusCode).toBe(404);
      expect(botCalls).toEqual([]);
    });

    it('answers 503 unavailable when the Bot API refuses or the links are not set', async () => {
      const user = await newUser();
      const cookId = await cookOnce(user);
      await shareCard(user, cookId);
      botFailure = 'Bad Request: wrong file identifier/HTTP URL specified';
      const refused = await call(user, 'POST', `/share/stamp/${cookId}`);
      expect(refused.statusCode).toBe(503);
      expect(errorCode(refused)).toBe('unavailable');

      const bare = buildApp({
        db: database.db,
        botToken: TOKEN,
        mediaDir,
        mediaSigningKey: MEDIA_KEY,
        apiTransformer: transformer,
      });
      try {
        const response = await bare.inject({
          method: 'POST',
          url: `/api/share/stamp/${cookId}`,
          headers: user.headers,
        });
        expect(response.statusCode).toBe(503);
        expect(errorCode(response)).toBe('unavailable');
      } finally {
        await bare.close();
      }
    });
  });

  describe('PATCH /cooks/:id', () => {
    it('adds an uploaded photo to the own cook without a photo, once', async () => {
      const user = await newUser();
      const other = await newUser();
      const dishId = dishesByCountry[0]?.dishIds[0] ?? '';
      const cook = createCookResponseSchema.parse(
        (await call(user, 'POST', '/cooks', { dishId })).json(),
      );
      const photoPath = await uploadPhoto(user);

      const foreignCook = await call(other, 'PATCH', `/cooks/${cook.cookId}`, {
        photoPath: await uploadPhoto(other),
      });
      expect(foreignCook.statusCode).toBe(404);
      const foreignPhoto = await call(user, 'PATCH', `/cooks/${cook.cookId}`, {
        photoPath: await uploadPhoto(other),
      });
      expect(foreignPhoto.statusCode).toBe(400);
      expect((await call(user, 'PATCH', '/cooks/not-a-uuid', { photoPath })).statusCode).toBe(404);
      expect((await call(user, 'PATCH', `/cooks/${randomUUID()}`, { photoPath })).statusCode).toBe(
        404,
      );
      expect((await call(user, 'PATCH', `/cooks/${cook.cookId}`, {})).statusCode).toBe(400);

      const added = await call(user, 'PATCH', `/cooks/${cook.cookId}`, { photoPath });
      expect(added.statusCode).toBe(200);
      expect(addCookPhotoResponseSchema.parse(added.json())).toEqual({
        cookId: cook.cookId,
        photoPath,
      });
      const [row] = await database.db
        .select({ photoPath: cooks.photoPath })
        .from(cooks)
        .where(eq(cooks.id, cook.cookId));
      expect(row?.photoPath).toBe(photoPath.slice('cooks/'.length));

      const again = await call(user, 'PATCH', `/cooks/${cook.cookId}`, {
        photoPath: await uploadPhoto(user),
      });
      expect(again.statusCode).toBe(400);
    });
  });

  describe('shopping', () => {
    it('adds, replaces, marks and clears the items of a dish', async () => {
      const user = await newUser();
      const other = await newUser();
      const add = async (servings: number, ingredientKeys: string[]) =>
        call(user, 'POST', '/shopping', { dishId: 'it-carbonara', servings, ingredientKeys });

      const added = await add(2, ['spaghetti', 'guanciale', 'salt']);
      expect(added.statusCode).toBe(201);
      expect(addShoppingResponseSchema.parse(added.json())).toEqual({ added: 3 });

      const list = () =>
        call(user, 'GET', '/shopping').then((response) =>
          shoppingResponseSchema.parse(response.json()),
        );
      const first = await list();
      expect(first.items.map((item) => item.name).length).toBe(3);
      const spaghetti = first.items.find((item) => item.product === 'spaghetti');
      if (!spaghetti) throw new Error('no spaghetti');

      const marked = await call(user, 'PATCH', `/shopping/${spaghetti.id}`, { checked: true });
      expect(marked.statusCode).toBe(200);
      expect(shoppingItemSchema.parse(marked.json()).checked).toBe(true);
      // Someone else's item is not found.
      expect(
        (await call(other, 'PATCH', `/shopping/${spaghetti.id}`, { checked: false })).statusCode,
      ).toBe(404);
      expect(
        (await call(user, 'PATCH', '/shopping/not-a-uuid', { checked: true })).statusCode,
      ).toBe(404);

      // Adding the dish again replaces its unchecked items; the bought one stays.
      await add(4, ['spaghetti', 'parmesan']);
      const second = await list();
      expect(second.items.map((item) => [item.product, item.amount, item.checked]).sort()).toEqual(
        [
          ['parmesan', 100, false],
          ['spaghetti', 200, true],
          ['spaghetti', 400, false],
        ].sort(),
      );

      const cleared = await call(user, 'DELETE', '/shopping/checked');
      expect(clearShoppingResponseSchema.parse(cleared.json())).toEqual({ removed: 1 });
      expect((await list()).items).toHaveLength(2);
    });

    it('rejects unknown ingredients and closed dishes', async () => {
      const user = await newUser();
      const unknown = await call(user, 'POST', '/shopping', {
        dishId: 'it-carbonara',
        servings: 2,
        ingredientKeys: ['nothing'],
      });
      expect(unknown.statusCode).toBe(400);

      await addCooks(user, FREE_COUNTRIES_LIMIT);
      const closed = await call(user, 'POST', '/shopping', {
        dishId: dishesByCountry[FREE_COUNTRIES_LIMIT]?.dishIds[0] ?? '',
        servings: 2,
        ingredientKeys: ['x'],
      });
      expect(closed.statusCode).toBe(403);
      expect(errorCode(closed)).toBe('paywall');
    });
  });
});
