import {
  DEFAULT_TEST_USER_ID,
  findUserByTgId,
  type UserFixture,
} from '../../mocks/fixtures/users.ts';

const STORAGE_KEY = 'tma80:mock-user';

const readStored = (): string | null => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (id: number) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage may be unavailable (private mode); the choice just will not survive navigation.
  }
};

/**
 * Picks the test user: `?user=<id>` from the URL, otherwise the one chosen earlier in this tab,
 * otherwise the default. The choice is kept in sessionStorage so in-app navigation keeps it.
 */
export function resolveTestUser(search: string): UserFixture {
  const requested = new URLSearchParams(search).get('user') ?? readStored();
  const requestedUser = requested ? findUserByTgId(Number(requested)) : undefined;
  if (requested && !requestedUser) {
    console.warn(
      `[tg mock] Unknown test user "${requested}", using ${String(DEFAULT_TEST_USER_ID)}`,
    );
  }
  const user = requestedUser ?? findUserByTgId(DEFAULT_TEST_USER_ID);
  if (!user) throw new Error('Default test user is missing in fixtures');
  store(user.tg.id);
  return user;
}
