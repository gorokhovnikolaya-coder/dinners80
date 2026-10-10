import {
  addShoppingResponseSchema,
  authResponseSchema,
  COOKS_PER_DAY_LIMIT,
  createCookResponseSchema,
  dishResponseSchema,
  homeResponseSchema,
  mapResponseSchema,
  meResponseSchema,
  paywallErrorSchema,
  uploadCookPhotoResponseSchema,
} from '@tma80/shared';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { API_URL } from '../api/config.ts';
import { buildMockInitData, parseInitDataUserId } from '../telegram/mock/initData.ts';
import { cooks } from './fixtures/cooks.ts';
import { dishes, dishIngredientNames } from './fixtures/dishes.ts';
import { TEST_USER_IDS, findUserByTgId } from './fixtures/users.ts';
import { NO_MOCK_CONTROLS, parseMockControls } from './controls.ts';
import { createMockDb } from './db.ts';
import { createHandlers, recordCook } from './handlers.ts';

const API_BASE = `http://localhost${API_URL}`;
const server = setupServer(...createHandlers(API_BASE));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const auth = (headers: HeadersInit = {}) => fetch(`${API_BASE}/auth`, { method: 'POST', headers });

const initDataOf = (tgId: number) => {
  const user = findUserByTgId(tgId);
  if (!user) throw new Error('missing fixture');
  return buildMockInitData(user.tg);
};

describe('mock initData', () => {
  it('round-trips the user id', () => {
    expect(parseInitDataUserId(initDataOf(TEST_USER_IDS.newbie))).toBe(TEST_USER_IDS.newbie);
    expect(parseInitDataUserId('user=%7Bbroken')).toBeUndefined();
    expect(parseInitDataUserId('auth_date=1')).toBeUndefined();
  });
});

describe('POST /auth (MSW)', () => {
  it('returns the profile of the user from initData', async () => {
    const response = await auth({ Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` });
    expect(response.status).toBe(200);
    const body = authResponseSchema.parse(await response.json());
    expect(body.user.firstName).toBe('Аня');
    expect(body.needsOnboarding).toBe(true);
  });

  it('returns subscription status for the subscribed user', async () => {
    const response = await auth({
      Authorization: `tma ${initDataOf(TEST_USER_IDS.tenCountriesSubscribed)}`,
    });
    const body = authResponseSchema.parse(await response.json());
    expect(body.subscription.active).toBe(true);
    expect(body.needsOnboarding).toBe(false);
  });

  it('rejects requests without initData or with an unknown user', async () => {
    const missing = await auth();
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({
      error: { code: 'unauthorized', message: expect.any(String) as string },
    });

    const unknown = await auth({ Authorization: 'tma user=%7B%22id%22%3A42%7D&hash=x' });
    expect(unknown.status).toBe(401);
  });

  it('fails once with 500 when mock_error=auth is set', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=auth')));
    const headers = { Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` };

    const failed = await auth(headers);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      error: { code: 'internal', message: expect.any(String) as string },
    });

    expect((await auth(headers)).status).toBe(200);
  });
});

describe('PATCH /me (MSW)', () => {
  const answers = {
    household: 'couple',
    weekdayMinutes: 30,
    exclusions: ['spicy', 'meat'],
    customExclusions: ['  Кинза ', 'грибы'],
    timezone: 'Asia/Novosibirsk',
  };

  const patchMe = (body: unknown, headers: Record<string, string>) =>
    fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('saves the onboarding answers and clears needsOnboarding for this db', async () => {
    const db = createMockDb();
    server.use(...createHandlers(API_BASE, NO_MOCK_CONTROLS, db));
    const headers = { Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` };

    const response = await patchMe(answers, headers);
    expect(response.status).toBe(200);
    const body = meResponseSchema.parse(await response.json());
    expect(body.needsOnboarding).toBe(false);
    expect(body.user).toMatchObject({
      household: 'couple',
      weekdayMinutes: 30,
      // Stored normalised: tags in canonical order, own words cleaned.
      exclusions: ['meat', 'spicy'],
      customExclusions: ['кинза', 'грибы'],
      timezone: 'Asia/Novosibirsk',
    });

    const authBody = authResponseSchema.parse(await (await auth(headers)).json());
    expect(authBody.needsOnboarding).toBe(false);
    expect(authBody.user.household).toBe('couple');
    // Fixtures stay untouched: a fresh mock backend still sees a newbie.
    expect(createMockDb().getUser(TEST_USER_IDS.newbie)?.onboarded).toBe(false);
  });

  it('persists changes through the storage and restores them', () => {
    let saved: unknown;
    const storage = {
      load: () => saved,
      save: (data: unknown) => {
        saved = JSON.parse(JSON.stringify(data));
      },
    };
    createMockDb(storage).updateUser(TEST_USER_IDS.newbie, {
      household: 'solo',
      weekdayMinutes: 20,
    });
    createMockDb(storage).updateUser(TEST_USER_IDS.newbie, {
      exclusions: ['gluten', 'meat'],
      customExclusions: ['Грибы'],
    });
    // Only the applied patch is stored, not the whole profile.
    expect(saved).toEqual({
      [TEST_USER_IDS.newbie]: {
        patch: {
          household: 'solo',
          weekdayMinutes: 20,
          exclusions: ['gluten', 'meat'],
          customExclusions: ['Грибы'],
        },
        onboarded: true,
        shopping: [],
        cooks: [],
      },
    });
    const restored = createMockDb(storage).getUser(TEST_USER_IDS.newbie);
    expect(restored?.onboarded).toBe(true);
    expect(restored?.profile).toEqual({
      ...findUserByTgId(TEST_USER_IDS.newbie)?.profile,
      household: 'solo',
      weekdayMinutes: 20,
      exclusions: ['meat', 'gluten'],
      customExclusions: ['грибы'],
    });

    // Broken data is ignored.
    expect(
      createMockDb({
        load: () => ({ 1001: { patch: { weekdayMinutes: 25 }, onboarded: true } }),
        save: () => undefined,
      }).getUser(TEST_USER_IDS.newbie)?.onboarded,
    ).toBe(false);
  });

  it('keeps needsOnboarding until both required answers are saved', async () => {
    server.use(...createHandlers(API_BASE, NO_MOCK_CONTROLS, createMockDb()));
    const headers = { Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` };
    const response = await patchMe({ household: 'solo' }, headers);
    expect(meResponseSchema.parse(await response.json()).needsOnboarding).toBe(true);
  });

  it('rejects invalid bodies and unauthenticated requests', async () => {
    const headers = { Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` };
    const invalid = await patchMe({ weekdayMinutes: 25 }, headers);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: { code: 'validation', message: expect.any(String) as string },
    });
    expect((await patchMe({}, headers)).status).toBe(400);
    expect((await patchMe(answers, {})).status).toBe(401);
  });

  it('fails once with 500 when mock_error=me is set, then saves', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=me')));
    const headers = { Authorization: `tma ${initDataOf(TEST_USER_IDS.newbie)}` };
    const failed = await patchMe(answers, headers);
    expect(failed.status).toBe(500);
    expect((await patchMe(answers, headers)).status).toBe(200);
  });
});

describe('GET /home (MSW)', () => {
  const home = (tgId: number, query: string) =>
    fetch(`${API_BASE}/home?${query}`, { headers: { Authorization: `tma ${initDataOf(tgId)}` } });
  const parse = async (response: Response) => homeResponseSchema.parse(await response.json());

  it('returns 3 suggestions and counters; own exclusions are applied on every page', async () => {
    const first = await parse(await home(TEST_USER_IDS.eightCountries, 'mode=weekday&page=0'));
    expect(first.suggestions).toHaveLength(3);
    expect(first.countriesCount).toBe(8);
    expect(first.countriesTotal).toBe(12);
    expect(first.dishesCount).toBe(10);
    expect(first.suggestions.every((card) => !card.locked && card.minutes <= 30)).toBe(true);
    const seen = new Set<string>();
    for (let page = 0; page < first.pageCount; page += 1) {
      const body = await parse(
        await home(TEST_USER_IDS.eightCountries, `mode=weekend&page=${String(page)}`),
      );
      for (const card of body.suggestions) seen.add(card.dishId);
    }
    for (const id of seen) {
      expect((dishIngredientNames[id] ?? []).some((name) => /свин/i.test(name))).toBe(false);
    }
  });

  it('a free user with 10 countries gets a locked card last; a subscriber does not', async () => {
    const free = await parse(await home(TEST_USER_IDS.tenCountriesFree, 'mode=weekend'));
    expect(free.suggestions.map((card) => card.locked)).toEqual([false, false, true]);
    expect(free.suggestions[2]?.label).toEqual({ kind: 'newCountry' });
    const paid = await parse(await home(TEST_USER_IDS.tenCountriesSubscribed, 'mode=weekend'));
    expect(paid.suggestions.some((card) => card.locked)).toBe(false);
  });

  it('validates the query and the user; fails once with mock_error=home', async () => {
    expect((await home(TEST_USER_IDS.eightCountries, 'mode=night')).status).toBe(400);
    expect((await fetch(`${API_BASE}/home?mode=weekday`)).status).toBe(401);
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=home')));
    expect((await home(TEST_USER_IDS.eightCountries, 'mode=weekday')).status).toBe(500);
    expect((await home(TEST_USER_IDS.eightCountries, 'mode=weekday')).status).toBe(200);
  });
});

describe('GET /map (MSW)', () => {
  const map = (tgId: number) =>
    fetch(`${API_BASE}/map`, { headers: { Authorization: `tma ${initDataOf(tgId)}` } });
  const parse = async (response: Response) => mapResponseSchema.parse(await response.json());
  const countriesOf = (body: Awaited<ReturnType<typeof parse>>) =>
    body.continents.flatMap((group) => group.countries);

  it('returns the passport by continent with counters, stamps and cooked dishes', async () => {
    const body = await parse(await map(TEST_USER_IDS.eightCountries));
    expect(body).toMatchObject({ countriesCount: 8, countriesTotal: 12, dishesCount: 10 });
    expect(body.continents.map((group) => group.id)).toEqual(['europe', 'asia', 'americas']);
    const all = countriesOf(body);
    expect(all).toHaveLength(12);
    expect(all.filter((country) => country.passed)).toHaveLength(8);
    expect(all.every((country) => country.dishes.length === 3 && !country.locked)).toBe(true);
    const japan = all.find((country) => country.id === 'jp');
    expect(japan?.passed).toBe(true);
    expect(japan?.firstStampAt).not.toBeNull();
    expect(japan?.dishes.filter((dish) => dish.cooked).map((dish) => dish.dishId)).toEqual([
      'jp-oyakodon',
    ]);
  });

  it('locks the new countries of a free user with 10 countries, not of a subscriber', async () => {
    const free = countriesOf(await parse(await map(TEST_USER_IDS.tenCountriesFree)));
    expect(free.filter((country) => country.locked).map((country) => country.id)).toEqual([
      'th',
      'co',
    ]);
    const paid = countriesOf(await parse(await map(TEST_USER_IDS.tenCountriesSubscribed)));
    expect(paid.some((country) => country.locked)).toBe(false);
  });

  it('needs the user; fails once with mock_error=map', async () => {
    expect((await fetch(`${API_BASE}/map`)).status).toBe(401);
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=map')));
    expect((await map(TEST_USER_IDS.eightCountries)).status).toBe(500);
    expect((await map(TEST_USER_IDS.eightCountries)).status).toBe(200);
  });
});

describe('GET /dishes/:id (MSW)', () => {
  const getDish = (tgId: number, path: string) =>
    fetch(`${API_BASE}/dishes/${path}`, { headers: { Authorization: `tma ${initDataOf(tgId)}` } });

  const closedDishOf = (tgId: number) => {
    const user = findUserByTgId(tgId);
    const passed = new Set(
      cooks.filter((cook) => cook.userId === user?.profile.id).map((cook) => cook.countryId),
    );
    const dish = dishes.find((item) => !passed.has(item.countryId));
    if (!dish) throw new Error('no closed dish');
    return dish;
  };

  it('returns the dish recalculated for the requested servings', async () => {
    const response = await getDish(TEST_USER_IDS.eightCountries, 'pe-ceviche?servings=3');
    expect(response.status).toBe(200);
    const body = dishResponseSchema.parse(await response.json());
    expect(body.servings).toBe(3);
    expect(body.baseServings).toBe(2);
    const fish = body.ingredients.find((item) => item.key === 'white_fish');
    expect(fish).toMatchObject({ baseAmount: 400, amount: 600, unit: 'g' });
    const salt = body.ingredients.find((item) => item.key === 'salt');
    expect(salt).toMatchObject({ amount: null, unit: null });
    expect(body.steps.map((step) => step.n)).toEqual([1, 2, 3, 4]);
  });

  it('defaults servings by «who eats» and labels the dish as on the main screen', async () => {
    // 1003 is a family (4 servings).
    const response = await getDish(TEST_USER_IDS.tenCountriesFree, 'it-carbonara');
    const body = dishResponseSchema.parse(await response.json());
    expect(body.servings).toBe(4);
    expect(body.label.kind).not.toBe('newCountry');
  });

  it('answers 403 paywall with a preview for a closed country, 200 with a subscription', async () => {
    const closed = closedDishOf(TEST_USER_IDS.tenCountriesFree);
    const response = await getDish(TEST_USER_IDS.tenCountriesFree, closed.id);
    expect(response.status).toBe(403);
    const body = paywallErrorSchema.parse(await response.json());
    expect(body.error.preview).toMatchObject({ dishId: closed.id, title: closed.title });
    expect(body.error.preview).not.toHaveProperty('ingredients');

    const subscribed = closedDishOf(TEST_USER_IDS.tenCountriesSubscribed);
    expect((await getDish(TEST_USER_IDS.tenCountriesSubscribed, subscribed.id)).status).toBe(200);
  });

  it('answers 404 for an unknown dish and 401 without initData', async () => {
    expect((await getDish(TEST_USER_IDS.eightCountries, 'xx-nothing')).status).toBe(404);
    expect((await fetch(`${API_BASE}/dishes/pe-ceviche`)).status).toBe(401);
  });

  it('fails once with 500 when mock_error=dish is set', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=dish')));
    expect((await getDish(TEST_USER_IDS.eightCountries, 'pe-ceviche')).status).toBe(500);
    expect((await getDish(TEST_USER_IDS.eightCountries, 'pe-ceviche')).status).toBe(200);
  });
});

describe('POST /shopping (MSW)', () => {
  const post = (tgId: number, body: unknown) =>
    fetch(`${API_BASE}/shopping`, {
      method: 'POST',
      headers: { Authorization: `tma ${initDataOf(tgId)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('adds the items and replaces the unchecked ones of the dish on a repeat', async () => {
    const db = createMockDb();
    server.use(...createHandlers(API_BASE, NO_MOCK_CONTROLS, db));
    const tgId = TEST_USER_IDS.eightCountries;

    const first = await post(tgId, {
      dishId: 'pe-ceviche',
      servings: 2,
      ingredientKeys: ['white_fish', 'lime', 'salt'],
    });
    expect(first.status).toBe(201);
    expect(addShoppingResponseSchema.parse(await first.json())).toEqual({ added: 3 });

    await post(tgId, { dishId: 'pe-ceviche', servings: 4, ingredientKeys: ['lime'] });
    await post(tgId, { dishId: 'it-carbonara', servings: 2, ingredientKeys: ['spaghetti'] });
    expect(
      db.getShopping(tgId).map(({ dishId, ingredientKey, servings }) => ({
        dishId,
        ingredientKey,
        servings,
      })),
    ).toEqual([
      { dishId: 'pe-ceviche', ingredientKey: 'lime', servings: 4 },
      { dishId: 'it-carbonara', ingredientKey: 'spaghetti', servings: 2 },
    ]);
  });

  it('rejects unknown ingredients, closed dishes and invalid bodies', async () => {
    const tgId = TEST_USER_IDS.tenCountriesFree;
    expect(
      (await post(tgId, { dishId: 'pe-ceviche', servings: 2, ingredientKeys: ['nope'] })).status,
    ).toBe(400);
    expect(
      (await post(tgId, { dishId: 'pe-ceviche', servings: 2, ingredientKeys: [] })).status,
    ).toBe(400);
    expect(
      (await post(tgId, { dishId: 'xx-nothing', servings: 2, ingredientKeys: ['a'] })).status,
    ).toBe(404);
  });

  it('fails once with 500 when mock_error=shopping is set', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=shopping')));
    const body = { dishId: 'pe-ceviche', servings: 2, ingredientKeys: ['lime'] };
    expect((await post(TEST_USER_IDS.eightCountries, body)).status).toBe(500);
    expect((await post(TEST_USER_IDS.eightCountries, body)).status).toBe(201);
  });
});

describe('POST /uploads/cook-photo (MSW)', () => {
  const upload = (tgId: number, blob: Blob) => {
    const form = new FormData();
    form.append('photo', blob, 'photo.jpg');
    return fetch(`${API_BASE}/uploads/cook-photo`, {
      method: 'POST',
      headers: { Authorization: `tma ${initDataOf(tgId)}` },
      body: form,
    });
  };
  const jpeg = (size: number) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' });

  it('stores a JPEG up to 500 KB in the user folder', async () => {
    const response = await upload(TEST_USER_IDS.eightCountries, jpeg(1000));
    expect(response.status).toBe(201);
    const { photoPath } = uploadCookPhotoResponseSchema.parse(await response.json());
    expect(photoPath.startsWith(`cooks/${String(findUserByTgId(1002)?.profile.id)}/`)).toBe(true);
  });

  it('rejects a large or non-JPEG file; fails once with mock_error=upload', async () => {
    expect((await upload(TEST_USER_IDS.eightCountries, jpeg(500 * 1024 + 1))).status).toBe(413);
    const png = new Blob([new Uint8Array(10)], { type: 'image/png' });
    expect((await upload(TEST_USER_IDS.eightCountries, png)).status).toBe(400);
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=upload')));
    expect((await upload(TEST_USER_IDS.eightCountries, jpeg(10))).status).toBe(500);
    expect((await upload(TEST_USER_IDS.eightCountries, jpeg(10))).status).toBe(201);
  });
});

describe('POST /cooks (MSW)', () => {
  const post = (tgId: number, body: unknown) =>
    fetch(`${API_BASE}/cooks`, {
      method: 'POST',
      headers: { Authorization: `tma ${initDataOf(tgId)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('a new country gives a stamp, counts and the overtaken friend', async () => {
    const db = createMockDb();
    server.use(...createHandlers(API_BASE, NO_MOCK_CONTROLS, db));
    const tgId = TEST_USER_IDS.eightCountries;
    const response = await post(tgId, { dishId: 'in-dal' });
    expect(response.status).toBe(201);
    expect(createCookResponseSchema.parse(await response.json())).toMatchObject({
      newCountry: true,
      countriesCount: 9,
      countriesTotal: 12,
      dishesCount: 11,
      overtook: 'Жанна',
    });
    // The cook is stored: the dish is now «Уже готовили», a repeat is not a new country.
    const repeat = createCookResponseSchema.parse(
      await (await post(tgId, { dishId: 'in-dal' })).json(),
    );
    expect(repeat).toMatchObject({
      newCountry: false,
      countriesCount: 9,
      dishesCount: 12,
      overtook: null,
    });
    expect(db.getUser(tgId)?.cooks.filter((cook) => cook.dishId === 'in-dal')).toHaveLength(2);
  });

  it('keeps a photo of the own folder and rejects someone else’s', async () => {
    const db = createMockDb();
    server.use(...createHandlers(API_BASE, NO_MOCK_CONTROLS, db));
    const own = `cooks/${String(findUserByTgId(1002)?.profile.id)}/0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg`;
    const other = `cooks/${String(findUserByTgId(1003)?.profile.id)}/0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg`;
    expect((await post(1002, { dishId: 'pe-ceviche', photoPath: own })).status).toBe(201);
    expect(db.getUser(1002)?.cooks.at(-1)?.photoPath).toBe(own);
    expect((await post(1002, { dishId: 'pe-ceviche', photoPath: other })).status).toBe(400);
  });

  it('answers 403 for a closed country, 404 for an unknown dish, 400 for a bad body', async () => {
    expect((await post(TEST_USER_IDS.tenCountriesFree, { dishId: 'th-green-curry' })).status).toBe(
      403,
    );
    expect((await post(TEST_USER_IDS.eightCountries, { dishId: 'xx-nothing' })).status).toBe(404);
    expect((await post(TEST_USER_IDS.eightCountries, {})).status).toBe(400);
  });

  it('keeps the recorded cooks through the storage', () => {
    let data: unknown;
    const storage = {
      load: () => data,
      save: (value: unknown) => {
        data = JSON.parse(JSON.stringify(value));
      },
    };
    expect(recordCook(createMockDb(storage), 1002, { dishId: 'in-dal' }).kind).toBe('ok');
    expect(createMockDb(storage).getUser(1002)?.cooks.at(-1)?.dishId).toBe('in-dal');
  });

  it('allows at most 20 cooks in 24 hours', () => {
    const db = createMockDb();
    const now = new Date();
    for (let index = 0; index < COOKS_PER_DAY_LIMIT; index += 1) {
      // Борис cooked one dish yesterday (fixture, 1 day ago — outside the 24 hours).
      expect(recordCook(db, 1002, { dishId: 'pe-ceviche' }, now).kind).toBe('ok');
    }
    expect(recordCook(db, 1002, { dishId: 'pe-ceviche' }, now).kind).toBe('rateLimited');
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1);
    expect(recordCook(db, 1002, { dishId: 'pe-ceviche' }, tomorrow).kind).toBe('ok');
  });

  it('answers 429 once when mock_error=cooks_limit is set', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=cooks_limit')));
    const first = await post(TEST_USER_IDS.eightCountries, { dishId: 'pe-ceviche' });
    expect(first.status).toBe(429);
    expect(((await first.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    expect((await post(TEST_USER_IDS.eightCountries, { dishId: 'pe-ceviche' })).status).toBe(201);
  });

  it('fails once with 500 when mock_error=cooks is set', async () => {
    server.use(...createHandlers(API_BASE, parseMockControls('?mock_error=cooks')));
    expect((await post(TEST_USER_IDS.eightCountries, { dishId: 'pe-ceviche' })).status).toBe(500);
    expect((await post(TEST_USER_IDS.eightCountries, { dishId: 'pe-ceviche' })).status).toBe(201);
  });
});
