import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { checkSecureLink, resignAuthorization, signInitData } from './localApi.ts';

const TOKEN = '42:test-local';
const USER = JSON.stringify({ id: 1002, first_name: 'Борис' });
/** Produced by the server's `signInitData` (apps/server/src/auth/initData.ts) for the same input. */
const SERVER_HASH = 'c5393d41fe543b560847df90a09a4597e546fe23af45a2f42121eae4c0c907bb';

describe('signInitData', () => {
  it('signs like the server does', () => {
    const signed = new URLSearchParams(
      signInitData({ user: USER, auth_date: '1760000000' }, TOKEN),
    );
    expect(signed.get('hash')).toBe(SERVER_HASH);
  });
});

describe('resignAuthorization', () => {
  it('replaces the placeholder hash and signature and refreshes auth_date', () => {
    const mock = new URLSearchParams({
      user: USER,
      auth_date: '1',
      signature: 'mock',
      hash: 'mock',
    }).toString();
    const header = resignAuthorization(`tma ${mock}`, TOKEN, new Date(1760000000 * 1000));
    expect(header?.startsWith('tma ')).toBe(true);
    const fields = new URLSearchParams(header?.slice(4));
    expect(fields.get('signature')).toBeNull();
    expect(fields.get('auth_date')).toBe('1760000000');
    expect(fields.get('hash')).toBe(SERVER_HASH);
  });

  it('leaves other headers alone', () => {
    expect(resignAuthorization(undefined, TOKEN)).toBeUndefined();
    expect(resignAuthorization('Bearer x', TOKEN)).toBeUndefined();
  });
});

describe('checkSecureLink', () => {
  const KEY = 'test-media-key-0123456789abcdefghijklmnop';
  const URI =
    '/media/cooks/00000000-0000-4000-8000-000000001002/0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg';
  /** What the server's `secureLinkHash` (apps/server/src/media/signedLink.ts) gives for URI, 1760000000, KEY. */
  const md5 = createHash('md5').update(`1760000000${URI} ${KEY}`).digest('base64url');
  const at = (seconds: number) => new Date(seconds * 1000);

  it('accepts the example of the nginx documentation', () => {
    expect(
      checkSecureLink('/s/link127.0.0.1', '_e4Nc3iduzkWRm01TBBNYw', '2147483647', 'secret', at(0)),
    ).toBe('ok');
  });

  it('accepts a valid link until it expires, like nginx', () => {
    expect(checkSecureLink(URI, md5, '1760000000', KEY, at(1760000000))).toBe('ok');
    expect(checkSecureLink(URI, md5, '1760000000', KEY, at(1760000001))).toBe('expired');
  });

  it('rejects a missing, wrong or foreign signature', () => {
    expect(checkSecureLink(URI, null, null, KEY, at(0))).toBe('invalid');
    expect(checkSecureLink(URI, md5, '1760000001', KEY, at(0))).toBe('invalid');
    expect(checkSecureLink(URI, md5, '1760000000', `${KEY}x`, at(0))).toBe('invalid');
    expect(checkSecureLink(URI.replace('1002', '1003'), md5, '1760000000', KEY, at(0))).toBe(
      'invalid',
    );
    expect(checkSecureLink(URI, md5, '-1', KEY, at(0))).toBe('invalid');
  });
});
