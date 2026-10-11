import { describe, expect, it } from 'vitest';

import {
  FRIENDS_FEED_LIMIT,
  buildLeaderboard,
  feedResponseSchema,
  firstStamps,
  latestFriendStamps,
  leaderboardQuerySchema,
  leaderboardResponseSchema,
  weekStart,
  type LeaderboardParticipant,
} from './friends.ts';

describe('weekStart', () => {
  it('is Monday 00:00 in the given time zone', () => {
    // Thursday 2026-10-15 12:00 UTC → Monday 2026-10-12 00:00 Moscow (UTC+3) = 2026-10-11 21:00 UTC.
    expect(weekStart(new Date('2026-10-15T12:00:00Z'), 'Europe/Moscow').toISOString()).toBe(
      '2026-10-11T21:00:00.000Z',
    );
  });

  it('on Monday morning is that very Monday', () => {
    expect(weekStart(new Date('2026-10-12T00:30:00+03:00'), 'Europe/Moscow').toISOString()).toBe(
      '2026-10-11T21:00:00.000Z',
    );
  });

  it('on Sunday night is the Monday six days before', () => {
    expect(weekStart(new Date('2026-10-18T23:59:00+03:00'), 'Europe/Moscow').toISOString()).toBe(
      '2026-10-11T21:00:00.000Z',
    );
  });

  it('depends on the zone of the asking user, not on UTC', () => {
    // Sunday 22:00 UTC is already Monday in Vladivostok (UTC+10).
    const now = new Date('2026-10-18T22:00:00Z');
    expect(weekStart(now, 'UTC').toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(weekStart(now, 'Asia/Vladivostok').toISOString()).toBe('2026-10-18T14:00:00.000Z');
  });

  it('handles a daylight saving change during the week', () => {
    // Berlin: CET (UTC+1) from 2026-10-25 03:00; Monday 2026-10-19 00:00 was CEST (UTC+2).
    expect(weekStart(new Date('2026-10-25T12:00:00Z'), 'Europe/Berlin').toISOString()).toBe(
      '2026-10-18T22:00:00.000Z',
    );
    // Monday 2026-10-26 00:00 CET.
    expect(weekStart(new Date('2026-10-27T12:00:00Z'), 'Europe/Berlin').toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    );
  });
});

describe('firstStamps', () => {
  it('keeps the first cook of each country', () => {
    const cooks = [
      { id: 'b', countryId: 'pe', createdAt: '2026-10-05T10:00:00Z' },
      { id: 'a', countryId: 'pe', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'c', countryId: 'it', createdAt: '2026-10-03T10:00:00Z' },
    ];
    expect(firstStamps(cooks).map((cook) => cook.id)).toEqual(['a', 'c']);
  });
});

const NOW = new Date('2026-10-15T12:00:00Z'); // Thursday; the week began 2026-10-11T21:00Z
const THIS_WEEK = '2026-10-13T10:00:00Z';
const LAST_WEEK = '2026-10-05T10:00:00Z';

const participant = (
  userId: string,
  firstName: string,
  cooks: [countryId: string, createdAt: string][],
): LeaderboardParticipant => ({
  userId,
  firstName,
  photoUrl: null,
  cooks: cooks.map(([countryId, createdAt]) => ({ countryId, createdAt })),
});

describe('buildLeaderboard', () => {
  const me = participant('me', 'Борис', [
    ['it', LAST_WEEK],
    ['fr', LAST_WEEK],
    ['pe', THIS_WEEK],
    ['pe', THIS_WEEK],
  ]);
  const zoya = participant('zoya', 'Зоя', [
    ['it', LAST_WEEK],
    ['fr', LAST_WEEK],
    ['es', LAST_WEEK],
    ['jp', LAST_WEEK],
  ]);
  const egor = participant('egor', 'Егор', [
    ['it', LAST_WEEK],
    ['it', THIS_WEEK],
    ['cn', THIS_WEEK],
  ]);

  it('«Всё время»: by countries, then by dishes', () => {
    const result = buildLeaderboard({
      me,
      friends: [egor, zoya],
      period: 'all',
      now: NOW,
      timezone: 'Europe/Moscow',
    });
    expect(leaderboardResponseSchema.parse(result)).toEqual(result);
    expect(result.entries.map((row) => [row.userId, row.place, row.countries, row.dishes])).toEqual(
      [
        ['zoya', 1, 4, 4],
        ['me', 2, 3, 4],
        ['egor', 3, 2, 3],
      ],
    );
    expect(result.entries.find((row) => row.isMe)?.userId).toBe('me');
  });

  it('«Эта неделя»: only first stamps of the week count as countries, all cooks of the week as dishes', () => {
    const result = buildLeaderboard({
      me,
      friends: [egor, zoya],
      period: 'week',
      now: NOW,
      timezone: 'Europe/Moscow',
    });
    // Борис: Peru is new this week (1), 2 cooks; Егор: China new (Italy is a repeat), 2 cooks.
    // Equal countries and dishes share the place; then by name (Борис < Егор).
    expect(result.entries.map((row) => [row.userId, row.place, row.countries, row.dishes])).toEqual(
      [
        ['me', 1, 1, 2],
        ['egor', 1, 1, 2],
        ['zoya', 3, 0, 0],
      ],
    );
  });

  it('places after a tie skip (1, 2, 2, 4)', () => {
    const a = participant('a', 'Аня', [
      ['it', LAST_WEEK],
      ['fr', LAST_WEEK],
    ]);
    const b = participant('b', 'Вера', [['it', LAST_WEEK]]);
    const c = participant('c', 'Глеб', [['fr', LAST_WEEK]]);
    const d = participant('d', 'Дина', []);
    const result = buildLeaderboard({
      me: d,
      friends: [c, b, a],
      period: 'all',
      now: NOW,
      timezone: 'UTC',
    });
    expect(result.entries.map((row) => [row.firstName, row.place])).toEqual([
      ['Аня', 1],
      ['Вера', 2],
      ['Глеб', 2],
      ['Дина', 4],
    ]);
  });

  it('lists the user alone when there are no friends', () => {
    const result = buildLeaderboard({
      me,
      friends: [],
      period: 'week',
      now: NOW,
      timezone: 'UTC',
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ isMe: true, place: 1 });
  });

  it('counts the week by the zone of the asking user', () => {
    // 2026-10-11 22:00 UTC is Monday 01:00 in Moscow (this week) but still Sunday in UTC.
    const friend = participant('f', 'Жанна', [['pe', '2026-10-11T22:00:00Z']]);
    const moscow = buildLeaderboard({
      me: participant('me', 'Борис', []),
      friends: [friend],
      period: 'week',
      now: NOW,
      timezone: 'Europe/Moscow',
    });
    const utc = buildLeaderboard({
      me: participant('me', 'Борис', []),
      friends: [friend],
      period: 'week',
      now: NOW,
      timezone: 'UTC',
    });
    expect(moscow.entries.find((row) => row.userId === 'f')?.countries).toBe(1);
    expect(utc.entries.find((row) => row.userId === 'f')?.countries).toBe(0);
  });
});

describe('latestFriendStamps', () => {
  it('takes first stamps of all friends, newest first, without repeats', () => {
    const egor = [
      { id: 'e1', countryId: 'it', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'e2', countryId: 'it', createdAt: '2026-10-14T10:00:00Z' },
      { id: 'e3', countryId: 'cn', createdAt: '2026-10-10T10:00:00Z' },
    ];
    const zoya = [{ id: 'z1', countryId: 'pe', createdAt: '2026-10-12T10:00:00Z' }];
    expect(latestFriendStamps([egor, zoya]).map((cook) => cook.id)).toEqual(['z1', 'e3', 'e1']);
  });

  it('returns at most 20 stamps', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      countryId: `c${String(index)}`,
      createdAt: new Date(Date.UTC(2026, 9, 1) + index * 60_000).toISOString(),
    }));
    const result = latestFriendStamps([many]);
    expect(result).toHaveLength(FRIENDS_FEED_LIMIT);
    expect(result[0]?.id).toBe('29');
  });
});

describe('schemas', () => {
  it('accept only known periods', () => {
    expect(leaderboardQuerySchema.safeParse({ period: 'week' }).success).toBe(true);
    expect(leaderboardQuerySchema.safeParse({ period: 'month' }).success).toBe(false);
  });

  it('reject a feed longer than 20', () => {
    const item = {
      cookId: 'c',
      userId: 'u',
      firstName: 'Зоя',
      countryId: 'pe',
      countryName: 'Перу',
      dishId: 'pe-ceviche',
      dishTitle: 'Севиче',
      photoUrl: null,
      createdAt: '2026-10-12T10:00:00Z',
    };
    expect(feedResponseSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(feedResponseSchema.safeParse({ items: Array(21).fill(item) }).success).toBe(false);
  });
});
