import type { LeaderboardEntry } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { formatFeedTime, hasFriends } from './friends.ts';

const TZ = 'Europe/Moscow';
// Thursday 15 October 2026, 14:00 in Moscow.
const NOW = new Date('2026-10-15T11:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('formatFeedTime', () => {
  it('says «только что» under a minute and for a time slightly in the future', () => {
    expect(formatFeedTime(ago(30 * 1000), NOW, TZ)).toBe('только что');
    expect(formatFeedTime(ago(-5 * 1000), NOW, TZ)).toBe('только что');
  });

  it('counts minutes under an hour', () => {
    expect(formatFeedTime(ago(MIN), NOW, TZ)).toBe('1 мин назад');
    expect(formatFeedTime(ago(59 * MIN), NOW, TZ)).toBe('59 мин назад');
  });

  it('counts hours today', () => {
    expect(formatFeedTime(ago(2 * HOUR), NOW, TZ)).toBe('2 ч назад');
    expect(formatFeedTime(ago(13 * HOUR + 59 * MIN), NOW, TZ)).toBe('13 ч назад');
  });

  it('says «вчера» for the previous day in the user zone', () => {
    // 00:30 Moscow today is today; 23:30 Moscow yesterday is «вчера».
    expect(formatFeedTime('2026-10-14T21:30:00Z', NOW, TZ)).toBe('13 ч назад');
    expect(formatFeedTime('2026-10-14T20:30:00Z', NOW, TZ)).toBe('вчера');
    expect(formatFeedTime('2026-10-13T21:30:00Z', NOW, TZ)).toBe('вчера');
  });

  it('shows the date for older stamps, with the year if it is not the current one', () => {
    expect(formatFeedTime('2026-10-13T20:30:00Z', NOW, TZ)).toBe('13 октября');
    expect(formatFeedTime('2025-12-31T12:00:00Z', NOW, TZ)).toBe('31 декабря 2025 г.');
  });
});

describe('hasFriends', () => {
  const row = (isMe: boolean): LeaderboardEntry => ({
    userId: isMe ? 'me' : 'f',
    firstName: 'Имя',
    photoUrl: null,
    isMe,
    place: 1,
    countries: 0,
    dishes: 0,
  });

  it('is false when only the user is in the ranking', () => {
    expect(hasFriends([row(true)])).toBe(false);
    expect(hasFriends([row(true), row(false)])).toBe(true);
  });
});
