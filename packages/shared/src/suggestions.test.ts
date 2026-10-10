import { describe, expect, it } from 'vitest';

import type { DishLevel, DishTag } from './constants.ts';
import { homeQuerySchema, homeResponseSchema } from './home.ts';
import {
  dailyRank,
  defaultSuggestionMode,
  localDateKey,
  suggestDishes,
  type SuggestionCook,
  type SuggestionDish,
  type SuggestionInput,
  type SuggestionUser,
} from './suggestions.ts';

const NOW = new Date('2026-10-08T15:00:00Z'); // Thursday
const DAY_MS = 24 * 60 * 60 * 1000;

const dish = (
  id: string,
  options: {
    level?: DishLevel;
    minutes?: number;
    tags?: DishTag[];
    ingredients?: string[];
    title?: string;
  } = {},
): SuggestionDish => ({
  id,
  countryId: id.split('-')[0] ?? id,
  title: options.title ?? id,
  level: options.level ?? 'weekday',
  minutes: options.minutes ?? 20,
  tags: options.tags ?? [],
  ingredients: (options.ingredients ?? []).map((name) => ({ name })),
});

const cook = (dishId: string, daysAgo: number): SuggestionCook => ({
  dishId,
  countryId: dishId.split('-')[0] ?? dishId,
  createdAt: new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString(),
});

const USER: SuggestionUser = {
  id: 'user-1',
  exclusions: [],
  customExclusions: [],
  weekdayMinutes: 30,
  timezone: 'Europe/Moscow',
  subscribed: false,
};

const run = (
  overrides: Omit<Partial<SuggestionInput>, 'user'> & { user?: Partial<SuggestionUser> },
) =>
  suggestDishes({
    dishes: [],
    cooks: [],
    mode: 'weekday',
    page: 0,
    now: NOW,
    ...overrides,
    user: { ...USER, ...overrides.user },
  });

const ids = (result: ReturnType<typeof suggestDishes>) => result.suggestions.map((s) => s.dishId);

/** All dish ids over all pages, in page order. */
const allIds = (overrides: Parameters<typeof run>[0]) => {
  const first = run(overrides);
  return Array.from({ length: first.pageCount }, (_, page) => ids(run({ ...overrides, page })));
};

describe('localDateKey / defaultSuggestionMode', () => {
  it('uses the user time zone', () => {
    const lateEvening = new Date('2026-10-09T22:30:00Z'); // Friday UTC, Saturday in Moscow
    expect(localDateKey(lateEvening, 'UTC')).toBe('2026-10-09');
    expect(localDateKey(lateEvening, 'Europe/Moscow')).toBe('2026-10-10');
    expect(defaultSuggestionMode(lateEvening, 'UTC')).toBe('weekday');
    expect(defaultSuggestionMode(lateEvening, 'Europe/Moscow')).toBe('weekend');
    expect(defaultSuggestionMode(new Date('2026-10-11T12:00:00Z'), 'UTC')).toBe('weekend');
    expect(defaultSuggestionMode(new Date('2026-10-12T12:00:00Z'), 'UTC')).toBe('weekday');
  });
});

describe('suggestDishes: filters', () => {
  it('weekdays: only weekday dishes within the time; weekends: weekend and challenge', () => {
    const dishes = [
      dish('a-1', { minutes: 30 }),
      dish('b-1', { minutes: 25 }),
      dish('c-1', { minutes: 20 }),
      dish('d-1', { minutes: 45 }),
      dish('e-1', { level: 'weekend', minutes: 90 }),
      dish('f-1', { level: 'challenge', minutes: 150 }),
    ];
    expect(new Set(ids(run({ dishes })))).toEqual(new Set(['a-1', 'b-1', 'c-1']));
    expect(new Set(ids(run({ dishes, mode: 'weekend' })))).toEqual(new Set(['e-1', 'f-1']));
  });

  it('excludes tags and own exclusions in the title or ingredients, and never relaxes them', () => {
    const dishes = [
      dish('a-1', { tags: ['meat'] }),
      dish('b-1', { ingredients: ['Свиной фарш'] }),
      dish('c-1', { title: 'Салат с кинзой' }),
      dish('d-1', { ingredients: ['Свёкла'] }),
      dish('e-1'),
    ];
    const result = run({
      dishes,
      user: { exclusions: ['meat'], customExclusions: ['свин', 'кинз', 'свекла'] },
    });
    expect(ids(result)).toEqual(['e-1']);
    expect(result.pageCount).toBe(1);
  });

  it('returns an empty page when nothing is left', () => {
    const result = run({
      dishes: [dish('a-1', { tags: ['spicy'] })],
      user: { exclusions: ['spicy'] },
    });
    expect(result).toEqual({ page: 0, pageCount: 1, suggestions: [] });
  });

  it('without a weekday time (not onboarded) has no time limit', () => {
    const dishes = [dish('a-1', { minutes: 45 })];
    expect(ids(run({ dishes, user: { weekdayMinutes: null } }))).toEqual(['a-1']);
  });
});

describe('suggestDishes: order', () => {
  const dishes = [
    dish('new1-1'),
    dish('new2-1'),
    dish('new3-1'),
    dish('old-1'),
    dish('old-2'),
    dish('old2-1'),
    dish('old2-2'),
    dish('old3-1'),
    dish('old3-2'),
  ];
  const cooks = [cook('old-1', 30), cook('old2-1', 20), cook('old3-1', 40)];

  it('new countries first, then untried dishes of passed countries, then old repeats', () => {
    const pages = allIds({ dishes, cooks });
    expect(pages).toHaveLength(3);
    expect(new Set(pages[0])).toEqual(new Set(['new1-1', 'new2-1', 'new3-1']));
    expect(new Set(pages[1])).toEqual(new Set(['old-2', 'old2-2', 'old3-2']));
    expect(new Set(pages[2])).toEqual(new Set(['old-1', 'old2-1', 'old3-1']));
  });

  it('labels: new country, n-th dish of a passed country, cooked before', () => {
    const labels = new Map(
      [0, 1, 2].flatMap((page) =>
        run({ dishes, cooks: [...cooks, cook('old-1', 50)], page }).suggestions.map((s) => [
          s.dishId,
          s.label,
        ]),
      ),
    );
    expect(labels.get('new1-1')).toEqual({ kind: 'newCountry' });
    expect(labels.get('old-2')).toEqual({ kind: 'nthDish', n: 2 });
    expect(labels.get('old-1')).toEqual({ kind: 'cookedBefore' });
  });

  it('ties are random, the same within a day and changing with the day or the user', () => {
    const many = Array.from({ length: 12 }, (_, i) => dish(`c${String(i)}-1`));
    const order = (now: Date, id = 'user-1') =>
      allIds({ dishes: many, now, user: { id } }).flat().join();
    expect(order(NOW)).toBe(order(new Date('2026-10-08T20:59:00Z'))); // 23:59 in Moscow
    expect(order(NOW)).not.toBe(order(new Date('2026-10-08T21:01:00Z'))); // next day in Moscow
    expect(order(NOW)).not.toBe(order(NOW, 'user-2'));
    // Independent of the input order.
    expect(
      allIds({ dishes: [...many].reverse() })
        .flat()
        .join(),
    ).toBe(order(NOW));
    expect(dailyRank('2026-10-08:u', 'a')).toBe(dailyRank('2026-10-08:u', 'a'));
  });
});

describe('suggestDishes: 14 days and relaxation', () => {
  it('skips dishes cooked within 14 days while there are enough others', () => {
    const dishes = [dish('a-1'), dish('a-2'), dish('b-1'), dish('c-1')];
    const result = run({ dishes, cooks: [cook('a-1', 13)] });
    expect(new Set(ids(result))).toEqual(new Set(['a-2', 'b-1', 'c-1']));
    expect(result.pageCount).toBe(1);
  });

  it('a cook 14+ days ago does not block the dish', () => {
    const dishes = [dish('a-1'), dish('a-2'), dish('b-1')];
    expect(new Set(ids(run({ dishes, cooks: [cook('a-1', 15)] })))).toEqual(
      new Set(['a-1', 'a-2', 'b-1']),
    );
  });

  it('first relaxes 14 days (oldest cook first), only up to 3 dishes', () => {
    const dishes = [dish('a-1'), dish('b-1'), dish('c-1'), dish('d-1')];
    const cooks = [cook('b-1', 2), cook('c-1', 10), cook('d-1', 5)];
    const result = run({ dishes, cooks });
    expect(ids(result)).toEqual(['a-1', 'c-1', 'd-1']);
    expect(result.pageCount).toBe(1);
  });

  it('then on weekdays adds longer dishes, the closest time first; never in weekend mode', () => {
    const dishes = [
      dish('a-1', { minutes: 20 }),
      dish('b-1', { minutes: 90 }),
      dish('c-1', { minutes: 45 }),
      dish('d-1', { minutes: 35 }),
    ];
    expect(ids(run({ dishes, cooks: [] }))).toEqual(['a-1', 'd-1', 'c-1']);
    // A recently cooked dish within the time comes before a longer one.
    expect(ids(run({ dishes, cooks: [cook('a-1', 1)] }))).toEqual(['a-1', 'd-1', 'c-1']);
    expect(
      ids(
        run({
          dishes: [dish('a-1', { minutes: 20 }), dish('b-1', { minutes: 25 })],
          cooks: [cook('a-1', 1)],
        }),
      ),
    ).toEqual(['b-1', 'a-1']);
  });

  it('shows as many as there are when even relaxed rules give fewer than 3', () => {
    const result = run({ dishes: [dish('a-1', { minutes: 60 })], cooks: [cook('a-1', 1)] });
    expect(ids(result)).toEqual(['a-1']);
    expect(result.suggestions[0]?.label).toEqual({ kind: 'cookedBefore' });
  });
  it('a cook exactly 14 days ago is not recent; a moment later than that it is', () => {
    const dishes = [dish('a-1'), dish('a-2'), dish('b-1'), dish('c-1')];
    const exactly = run({ dishes, cooks: [cook('a-1', 14)] });
    expect(exactly.pageCount).toBe(2);
    expect([...ids(exactly), ...ids(run({ dishes, cooks: [cook('a-1', 14)], page: 1 }))]).toContain(
      'a-1',
    );
    const justInside = run({ dishes, cooks: [cook('a-1', 14 - 1 / DAY_MS)] });
    expect(justInside.pageCount).toBe(1);
    expect(ids(justInside)).not.toContain('a-1');
  });
});

describe('suggestDishes: pages', () => {
  it('goes round: page = requested page modulo the page count', () => {
    const dishes = Array.from({ length: 6 }, (_, i) => dish(`c${String(i)}-1`));
    expect(run({ dishes }).pageCount).toBe(2);
    expect(ids(run({ dishes, page: 2 }))).toEqual(ids(run({ dishes, page: 0 })));
    expect(run({ dishes, page: 3 }).page).toBe(1);
    expect(new Set([...ids(run({ dishes, page: 0 })), ...ids(run({ dishes, page: 1 }))]).size).toBe(
      6,
    );
  });

  it('fills the last incomplete page from the start of the list', () => {
    const dishes = Array.from({ length: 4 }, (_, i) => dish(`c${String(i)}-1`));
    const pages = allIds({ dishes });
    expect(pages).toHaveLength(2);
    expect(pages[1]).toHaveLength(3);
    expect(new Set(pages[1]).size).toBe(3);
    expect(pages[1]?.slice(1)).toEqual(pages[0]?.slice(0, 2));
  });

  it('avoids two dishes of one country on a page when possible', () => {
    const dishes = [
      dish('a-1', { level: 'weekend' }),
      dish('a-2', { level: 'challenge' }),
      dish('b-1', { level: 'weekend' }),
      dish('b-2', { level: 'challenge' }),
      dish('c-1', { level: 'weekend' }),
      dish('c-2', { level: 'challenge' }),
    ];
    for (const page of allIds({ dishes, mode: 'weekend' })) {
      expect(new Set(page.map((id) => id.split('-')[0])).size).toBe(3);
    }
    // Only one country: repeats are unavoidable.
    expect(ids(run({ dishes: dishes.slice(0, 2), mode: 'weekend' }))).toHaveLength(2);
  });
});

describe('suggestDishes: free user with 10 countries', () => {
  const passed = Array.from({ length: 10 }, (_, i) => `p${String(i)}`);
  const cooks = passed.map((country) => cook(`${country}-1`, 30));
  const dishes = [
    ...passed.flatMap((country) => [dish(`${country}-1`), dish(`${country}-2`)]),
    dish('n1-1'),
    dish('n2-1', { minutes: 45 }),
  ];

  it('2 open dishes of passed countries and a locked new-country dish last', () => {
    const result = run({ dishes, cooks });
    expect(result.suggestions).toHaveLength(3);
    const [first, second, third] = result.suggestions;
    expect(first?.locked).toBe(false);
    expect(second?.locked).toBe(false);
    expect(first?.label).toEqual({ kind: 'nthDish', n: 2 });
    expect(third).toEqual({ dishId: 'n1-1', label: { kind: 'newCountry' }, locked: true });
    // 10 untried + 10 repeats → 10 pages of 2; the locked dish alternates, fitting time first.
    expect(result.pageCount).toBe(10);
    expect(run({ dishes, cooks, page: 1 }).suggestions[2]?.dishId).toBe('n2-1');
    // Untried dishes come before repeats.
    const open = allIds({ dishes, cooks }).flatMap((page) => page.slice(0, 2));
    expect(open.slice(0, 10).every((id) => id.endsWith('-2'))).toBe(true);
  });

  it('no locked card with a subscription or with fewer than 10 countries', () => {
    const subscribed = run({ dishes, cooks, user: { subscribed: true } });
    expect(subscribed.suggestions.every((s) => !s.locked)).toBe(true);
    expect(subscribed.suggestions[0]?.label).toEqual({ kind: 'newCountry' });
    const nine = run({ dishes, cooks: cooks.slice(1) });
    expect(nine.suggestions.every((s) => !s.locked)).toBe(true);
  });

  it('3 open cards when no new-country dish fits the filters', () => {
    const result = run({ dishes, cooks, user: { customExclusions: ['n1', 'n2'] } });
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.every((s) => !s.locked)).toBe(true);
  });
  it('relaxes up to 2 open dishes: recent cooks first (oldest first)', () => {
    const recent = passed.map((country, index) => cook(`${country}-1`, 1 + index));
    const result = run({
      dishes: [...passed.map((country) => dish(`${country}-1`)), dish('n1-1')],
      cooks: recent,
    });
    expect(result.pageCount).toBe(1);
    expect(result.suggestions).toEqual([
      { dishId: 'p9-1', label: { kind: 'cookedBefore' }, locked: false },
      { dishId: 'p8-1', label: { kind: 'cookedBefore' }, locked: false },
      { dishId: 'n1-1', label: { kind: 'newCountry' }, locked: true },
    ]);
  });

  it('on weekdays adds a longer dish to fill the 2 open places, the closest time first', () => {
    // Countries are passed with weekend dishes; weekday dishes: one fits 30 min, two are longer.
    const weekendCooks = passed.map((country) => cook(`${country}-w`, 30));
    const result = run({
      dishes: [
        dish('p0-1', { minutes: 20 }),
        dish('p1-1', { minutes: 60 }),
        dish('p2-1', { minutes: 35 }),
        dish('n1-1', { minutes: 20 }),
      ],
      cooks: weekendCooks,
    });
    expect(result.pageCount).toBe(1);
    expect(ids(result)).toEqual(['p0-1', 'p2-1', 'n1-1']);
    expect(result.suggestions[0]?.label).toEqual({ kind: 'nthDish', n: 2 });
    expect(result.suggestions[2]?.locked).toBe(true);
  });

  it('weekends: the locked card is a weekend or challenge dish and goes round with the pages', () => {
    const weekdayCooks = passed.map((country) => cook(`${country}-d`, 30));
    const weekendDishes = [
      ...passed.map((country) => dish(`${country}-1`, { level: 'weekend' })),
      dish('n1-1', { level: 'weekend', minutes: 90 }),
      dish('n1-2', { level: 'challenge', minutes: 150 }),
      dish('n2-1', { level: 'weekend', minutes: 60 }),
      dish('n3-1', { level: 'weekday' }),
    ];
    const lockedOn = (page: number) => {
      const result = run({ dishes: weekendDishes, cooks: weekdayCooks, mode: 'weekend', page });
      expect(result.pageCount).toBe(5);
      expect(result.suggestions).toHaveLength(3);
      const last = result.suggestions[2];
      expect(last?.locked).toBe(true);
      return last?.dishId;
    };
    const firstThree = [lockedOn(0), lockedOn(1), lockedOn(2)];
    expect(new Set(firstThree)).toEqual(new Set(['n1-1', 'n1-2', 'n2-1']));
    expect(lockedOn(3)).toBe(firstThree[0]);
    expect(lockedOn(4)).toBe(firstThree[1]);
    expect(lockedOn(5)).toBe(firstThree[0]); // page 5 → page 0
  });
});

describe('home schemas', () => {
  it('parses the query with a default page', () => {
    expect(homeQuerySchema.parse({ mode: 'weekend', page: '2' })).toEqual({
      mode: 'weekend',
      page: 2,
    });
    expect(homeQuerySchema.parse({ mode: 'weekday' })).toEqual({ mode: 'weekday', page: 0 });
    expect(homeQuerySchema.safeParse({ mode: 'night' }).success).toBe(false);
  });

  it('checks the labels', () => {
    const card = {
      dishId: 'pe-lomo',
      title: 'Ломо сальтадо',
      countryId: 'pe',
      countryName: 'Перу',
      level: 'weekday',
      minutes: 30,
      imageUrl: '/media/pe/lomo.webp',
      locked: false,
    };
    const response = (label: unknown) => ({
      mode: 'weekday',
      page: 0,
      pageCount: 1,
      suggestions: [{ ...card, label }],
      countriesCount: 1,
      countriesTotal: 30,
      dishesCount: 1,
    });
    expect(homeResponseSchema.safeParse(response({ kind: 'nthDish', n: 2 })).success).toBe(true);
    expect(homeResponseSchema.safeParse(response({ kind: 'nthDish' })).success).toBe(false);
    expect(homeResponseSchema.safeParse(response({ kind: 'other' })).success).toBe(false);
  });
});
