import type { TelegramUserFixture } from '../../mocks/fixtures/users.ts';

/** Placeholder signature: MSW does not check it. Real signing is a server concern (task 15). */
export const MOCK_INIT_DATA_HASH = 'mock';

/**
 * Builds a raw initData query string the way Telegram sends it: `user` as JSON, `auth_date` in
 * seconds, `hash` and `signature`.
 */
export function buildMockInitData(user: TelegramUserFixture, now = new Date()): string {
  return new URLSearchParams({
    user: JSON.stringify(user),
    chat_instance: '-1000000000000',
    chat_type: 'sender',
    auth_date: String(Math.floor(now.getTime() / 1000)),
    signature: MOCK_INIT_DATA_HASH,
    hash: MOCK_INIT_DATA_HASH,
  }).toString();
}

/** Telegram user id from a raw initData string, or `undefined` if it is missing or malformed. */
export function parseInitDataUserId(initData: string): number | undefined {
  const raw = new URLSearchParams(initData).get('user');
  if (!raw) return undefined;
  try {
    const user: unknown = JSON.parse(raw);
    if (typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'number') {
      return user.id;
    }
  } catch {
    // Malformed JSON — treated as no user.
  }
  return undefined;
}
