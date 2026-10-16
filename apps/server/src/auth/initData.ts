import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod/mini';

import { AUTH_SCHEME } from '@tma80/shared';

/**
 * Validation of the Mini App init data (core.telegram.org/bots/webapps, «Validating data received
 * via the Mini App»): the data-check-string is every received field except `hash`, sorted by key,
 * as `key=<value>` joined with `\n`; the secret key is HMAC-SHA256 of the bot token with the key
 * `WebAppData`; the hex HMAC-SHA256 of the data-check-string with that secret must equal `hash`.
 * Data older than `INIT_DATA_MAX_AGE_SECONDS` is rejected (ТЗ, «Авторизация»).
 */

/** Init data older than 24 hours is rejected. */
export const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
/** `auth_date` may be this far in the future: clock drift between Telegram and the server. */
export const INIT_DATA_MAX_FUTURE_SECONDS = 5 * 60;

/** Value of `startapp` in `t.me/<bot>/<app>?startapp=<code>`: Telegram allows these characters. */
const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** `WebAppUser` fields the server uses; other fields are dropped. */
const initDataUserSchema = z.object({
  id: z.int().check(z.positive()),
  first_name: z.string(),
  username: z.optional(z.string()),
  photo_url: z.optional(z.string()),
  allows_write_to_pm: z.optional(z.boolean()),
});

export interface InitDataUser {
  tgId: number;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  /** The user allowed the bot to write to them (`allows_write_to_pm`). */
  allowsWriteToPm: boolean;
}

export interface InitData {
  authDate: Date;
  user: InitDataUser;
  /** `start_param` when it looks like a `startapp` value, otherwise `null`. */
  startParam: string | null;
}

export type InitDataError =
  'missing' | 'malformed' | 'bad_signature' | 'expired' | 'from_future' | 'no_user';

export type InitDataResult = { ok: true; data: InitData } | { ok: false; reason: InitDataError };

const hmac = (key: string | Buffer, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();

const secretKey = (botToken: string): Buffer => hmac('WebAppData', botToken);

const dataCheckString = (fields: readonly (readonly [string, string])[]): string =>
  fields
    .filter(([key]) => key !== 'hash')
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

/**
 * Signs init data fields with the bot token the way Telegram does and returns the raw query
 * string with `hash`. For tests and for local development with a test token.
 */
export function signInitData(fields: Readonly<Record<string, string>>, botToken: string): string {
  const entries = Object.entries(fields).filter(([key]) => key !== 'hash');
  const hash = hmac(secretKey(botToken), dataCheckString(entries)).toString('hex');
  return new URLSearchParams([...entries, ['hash', hash]]).toString();
}

const parseUser = (raw: string | undefined): InitDataUser | undefined => {
  if (raw === undefined) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = initDataUserSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const user = parsed.data;
  return {
    tgId: user.id,
    firstName: user.first_name,
    username: user.username ?? null,
    photoUrl: user.photo_url ?? null,
    allowsWriteToPm: user.allows_write_to_pm === true,
  };
};

/**
 * Checks the raw init data string: signature, age and the `user` field.
 * @param raw - `Telegram.WebApp.initData` as the client sent it.
 * @param botToken - token of the bot that opened the Mini App.
 * @param now - current time (injected in tests).
 */
export function validateInitData(raw: string, botToken: string, now = new Date()): InitDataResult {
  if (raw === '') return { ok: false, reason: 'missing' };
  const fields = [...new URLSearchParams(raw)];
  const keys = new Set(fields.map(([key]) => key));
  if (keys.size !== fields.length) return { ok: false, reason: 'malformed' };
  const values = new Map(fields);

  const hash = values.get('hash');
  if (hash === undefined || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: 'malformed' };
  const expected = hmac(secretKey(botToken), dataCheckString(fields));
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) {
    return { ok: false, reason: 'bad_signature' };
  }

  const authDateRaw = values.get('auth_date');
  if (authDateRaw === undefined || !/^\d{1,12}$/.test(authDateRaw)) {
    return { ok: false, reason: 'malformed' };
  }
  const authDateSeconds = Number(authDateRaw);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (nowSeconds - authDateSeconds > INIT_DATA_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'expired' };
  }
  if (authDateSeconds - nowSeconds > INIT_DATA_MAX_FUTURE_SECONDS) {
    return { ok: false, reason: 'from_future' };
  }

  const user = parseUser(values.get('user'));
  if (!user) return { ok: false, reason: 'no_user' };

  const startParam = values.get('start_param');
  return {
    ok: true,
    data: {
      authDate: new Date(authDateSeconds * 1000),
      user,
      startParam: startParam !== undefined && START_PARAM_RE.test(startParam) ? startParam : null,
    },
  };
}

/** Validates the `Authorization: tma <initData>` header. */
export function validateAuthorization(
  header: string | undefined,
  botToken: string,
  now = new Date(),
): InitDataResult {
  const prefix = `${AUTH_SCHEME} `;
  if (header?.startsWith(prefix) !== true) return { ok: false, reason: 'missing' };
  return validateInitData(header.slice(prefix.length).trim(), botToken, now);
}
