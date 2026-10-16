import { describe, expect, it } from 'vitest';

import { resignAuthorization, signInitData } from './localApi.ts';

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
