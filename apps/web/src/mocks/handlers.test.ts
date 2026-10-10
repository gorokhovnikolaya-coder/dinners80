import { authResponseSchema, homeResponseSchema, meResponseSchema } from '@tma80/shared';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { API_URL } from '../api/config.ts';
import { buildMockInitData, parseInitDataUserId } from '../telegram/mock/initData.ts';
import { dishIngredientNames } from './fixtures/dishes.ts';
import { TEST_USER_IDS, findUserByTgId } from './fixtures/users.ts';
import { NO_MOCK_CONTROLS, parseMockControls } from './controls.ts';
import { createMockDb } from './db.ts';
import { createHandlers } from './handlers.ts';

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
