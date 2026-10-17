import { describe, expect, it } from 'vitest';

import { isPremiumUser } from './share.ts';

const initData = (user: unknown) =>
  new URLSearchParams({ user: JSON.stringify(user), hash: 'x' }).toString();

describe('isPremiumUser', () => {
  it('reads is_premium of the initData user', () => {
    expect(isPremiumUser(initData({ id: 1, is_premium: true }))).toBe(true);
    expect(isPremiumUser(initData({ id: 1, is_premium: false }))).toBe(false);
    expect(isPremiumUser(initData({ id: 1 }))).toBe(false);
  });

  it('is false without initData or with a malformed user', () => {
    expect(isPremiumUser(undefined)).toBe(false);
    expect(isPremiumUser('user=%7Bbroken')).toBe(false);
    expect(isPremiumUser('hash=x')).toBe(false);
  });
});
