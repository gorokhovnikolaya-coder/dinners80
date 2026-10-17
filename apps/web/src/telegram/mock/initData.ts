import type { TelegramUserFixture } from '../../mocks/fixtures/users.ts';

/** Placeholder signature: MSW does not check it. Real signing is a server concern (task 15). */
export const MOCK_INIT_DATA_HASH = 'mock';

/** Telegram start parameters allow `[A-Za-z0-9_-]`, up to 64 characters. */
const START_PARAM = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `?startapp=<code>` of the page: the mock of a launch by `t.me/<bot>/<app>?startapp=<code>`
 * (an invitation). `null` without it or with a value Telegram would not pass.
 */
export function parseMockStartParam(search: string): string | null {
  const value = new URLSearchParams(search).get('startapp');
  return value !== null && START_PARAM.test(value) ? value : null;
}

/** `start_param` of a raw initData string, or `undefined` without it. */
export function parseInitDataStartParam(initData: string): string | undefined {
  return new URLSearchParams(initData).get('start_param') ?? undefined;
}

/**
 * Builds a raw initData query string the way Telegram sends it: `user` as JSON, `start_param`
 * of an invitation link, `auth_date` in seconds, `hash` and `signature`.
 */
export function buildMockInitData(
  user: TelegramUserFixture,
  now = new Date(),
  startParam: string | null = null,
): string {
  return new URLSearchParams({
    user: JSON.stringify(user),
    chat_instance: '-1000000000000',
    chat_type: 'sender',
    ...(startParam === null ? {} : { start_param: startParam }),
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
