import { authResponseSchema } from '@tma80/shared';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { API_URL } from '../api/config.ts';
import { buildMockInitData, parseInitDataUserId } from '../telegram/mock/initData.ts';
import { TEST_USER_IDS, findUserByTgId } from './fixtures/users.ts';
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
});
