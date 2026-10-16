import { describe, expect, it } from 'vitest';

import { users } from '../../web/src/mocks/fixtures/users.ts';
import { devUserRows } from './devUsers.ts';

describe('devUserRows', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const rows = devUserRows(now);

  it('keeps the fixture users with their ids, answers and onboarding', () => {
    expect(rows.users.map((user) => user.tgId)).toEqual(users.map((user) => user.tg.id));
    const newbie = rows.users.find((user) => user.tgId === 1001);
    expect(newbie).toMatchObject({ onboardedAt: null, household: null });
    expect(rows.users.find((user) => user.tgId === 1002)?.onboardedAt).toEqual(now);
  });

  it('stores friendships both ways and photos without the folder name', () => {
    expect(rows.friendships).toHaveLength(2 * 10);
    expect(rows.cooks.some((cook) => cook.photoPath !== null)).toBe(true);
    expect(rows.cooks.every((cook) => cook.photoPath?.startsWith('cooks/') !== true)).toBe(true);
  });

  it('gives an active subscription to 1004 and an expired one to 1003', () => {
    const byUser = (tgId: number) => {
      const id = users.find((user) => user.tg.id === tgId)?.profile.id;
      return rows.subscriptions.find((subscription) => subscription.userId === id);
    };
    expect(byUser(1004)).toMatchObject({ plan: 'month', status: 'active', starsAmount: 150 });
    expect(byUser(1003)?.status).toBe('expired');
    expect(byUser(1002)).toBeUndefined();
  });
});
