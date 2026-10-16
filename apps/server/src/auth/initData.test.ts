import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  INIT_DATA_MAX_AGE_SECONDS,
  INIT_DATA_MAX_FUTURE_SECONDS,
  signInitData,
  validateAuthorization,
  validateInitData,
} from './initData.ts';

const TOKEN = '123456789:test-bot-token';
const NOW = new Date('2026-10-16T18:00:00Z');
const nowSeconds = NOW.getTime() / 1000;

const user = { id: 1002, first_name: 'Маша', username: 'masha', allows_write_to_pm: true };

const fields = (overrides: Record<string, string> = {}) => ({
  auth_date: String(nowSeconds - 60),
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user: JSON.stringify(user),
  signature: 'ed25519-signature-from-telegram',
  ...overrides,
});

describe('validateInitData', () => {
  it('accepts data signed with the bot token', () => {
    const result = validateInitData(
      signInitData(fields({ start_param: 'Ab3dE6gH9k' }), TOKEN),
      TOKEN,
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        authDate: new Date((nowSeconds - 60) * 1000),
        user: {
          tgId: 1002,
          firstName: 'Маша',
          username: 'masha',
          photoUrl: null,
          allowsWriteToPm: true,
        },
        startParam: 'Ab3dE6gH9k',
      },
    });
  });

  it('matches the algorithm of core.telegram.org independently of signInitData', () => {
    // Data-check-string: all fields but `hash`, sorted by key, `key=value` joined with `\n`.
    const data = fields();
    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key as keyof typeof data]}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    const raw = new URLSearchParams({ ...data, hash }).toString();
    expect(validateInitData(raw, TOKEN, NOW).ok).toBe(true);
  });

  it('rejects a forged signature', () => {
    const raw = signInitData(fields(), TOKEN);
    expect(validateInitData(raw, 'another:token', NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects data changed after signing', () => {
    const params = new URLSearchParams(signInitData(fields(), TOKEN));
    params.set('user', JSON.stringify({ ...user, id: 1004 }));
    expect(validateInitData(params.toString(), TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    const withInvite = new URLSearchParams(signInitData(fields(), TOKEN));
    withInvite.set('start_param', 'stolen');
    expect(validateInitData(withInvite.toString(), TOKEN, NOW).ok).toBe(false);
  });

  it('rejects data older than 24 hours', () => {
    const old = signInitData(
      fields({ auth_date: String(nowSeconds - INIT_DATA_MAX_AGE_SECONDS - 1) }),
      TOKEN,
    );
    expect(validateInitData(old, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
    const edge = signInitData(
      fields({ auth_date: String(nowSeconds - INIT_DATA_MAX_AGE_SECONDS) }),
      TOKEN,
    );
    expect(validateInitData(edge, TOKEN, NOW).ok).toBe(true);
  });

  it('allows a small clock drift but rejects data from the future', () => {
    const drift = signInitData(
      fields({ auth_date: String(nowSeconds + INIT_DATA_MAX_FUTURE_SECONDS) }),
      TOKEN,
    );
    expect(validateInitData(drift, TOKEN, NOW).ok).toBe(true);
    const future = signInitData(
      fields({ auth_date: String(nowSeconds + INIT_DATA_MAX_FUTURE_SECONDS + 1) }),
      TOKEN,
    );
    expect(validateInitData(future, TOKEN, NOW)).toEqual({ ok: false, reason: 'from_future' });
  });

  it('rejects malformed data', () => {
    expect(validateInitData('', TOKEN, NOW)).toEqual({ ok: false, reason: 'missing' });
    const noHash = new URLSearchParams(fields()).toString();
    expect(validateInitData(noHash, TOKEN, NOW)).toEqual({ ok: false, reason: 'malformed' });
    const signed = signInitData(fields(), TOKEN);
    expect(validateInitData(`${signed}&auth_date=1`, TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    const noDate = signInitData({ user: JSON.stringify(user) }, TOKEN);
    expect(validateInitData(noDate, TOKEN, NOW)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('requires a valid user', () => {
    const noUser = signInitData({ auth_date: String(nowSeconds) }, TOKEN);
    expect(validateInitData(noUser, TOKEN, NOW)).toEqual({ ok: false, reason: 'no_user' });
    const badJson = signInitData(fields({ user: '{not json' }), TOKEN);
    expect(validateInitData(badJson, TOKEN, NOW)).toEqual({ ok: false, reason: 'no_user' });
    const badId = signInitData(fields({ user: JSON.stringify({ ...user, id: -1 }) }), TOKEN);
    expect(validateInitData(badId, TOKEN, NOW)).toEqual({ ok: false, reason: 'no_user' });
  });

  it('drops a start_param that is not a startapp value', () => {
    const raw = signInitData(fields({ start_param: 'bad code!' }), TOKEN);
    const result = validateInitData(raw, TOKEN, NOW);
    expect(result.ok && result.data.startParam).toBeNull();
  });
});

describe('validateAuthorization', () => {
  it('reads the `tma` scheme', () => {
    const raw = signInitData(fields(), TOKEN);
    expect(validateAuthorization(`tma ${raw}`, TOKEN, NOW).ok).toBe(true);
    expect(validateAuthorization(`Bearer ${raw}`, TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(validateAuthorization(undefined, TOKEN, NOW)).toEqual({ ok: false, reason: 'missing' });
  });
});
