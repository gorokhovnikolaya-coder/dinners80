import { describe, expect, it } from 'vitest';

import { countrySchema } from './content.ts';
import {
  buildPassport,
  mapResponseSchema,
  type PassportCook,
  type PassportCountry,
  type PassportDish,
} from './map.ts';

const country = (
  id: string,
  continent: PassportCountry['continent'],
  sort: number,
): PassportCountry => ({ id, name: id.toUpperCase(), continent, sort });

const dish = (id: string, countryId: string, level: PassportDish['level']): PassportDish => ({
  id,
  countryId,
  title: id,
  level,
  minutes: 30,
  imageUrl: `/img/${id}.webp`,
});

const cook = (dishId: string, countryId: string, createdAt: string): PassportCook => ({
  dishId,
  countryId,
  createdAt,
});

const countries = [
  country('pe', 'americas', 3),
  country('it', 'europe', 2),
  country('fr', 'europe', 1),
  country('jp', 'asia', 4),
];

const dishes = [
  dish('it-c', 'it', 'challenge'),
  dish('it-a', 'it', 'weekday'),
  dish('it-b', 'it', 'weekend'),
  dish('fr-a', 'fr', 'weekday'),
  dish('pe-a', 'pe', 'weekday'),
  dish('jp-a', 'jp', 'weekend'),
];

/** Ten passed countries for the free limit: `c0`…`c9` in Europe plus one closed `x`. */
const tenPassed = () => {
  const ids = Array.from({ length: 10 }, (_, index) => `c${String(index)}`);
  return {
    countries: [...ids.map((id, index) => country(id, 'europe', index)), country('x', 'asia', 99)],
    dishes: [...ids.map((id) => dish(`${id}-a`, id, 'weekday')), dish('x-a', 'x', 'weekday')],
    cooks: ids.map((id) => cook(`${id}-a`, id, '2026-09-01T18:00:00Z')),
  };
};

describe('buildPassport', () => {
  it('groups countries by continent in the fixed order, by sort, and leaves empty continents out', () => {
    const passport = buildPassport({ countries, dishes, cooks: [], subscribed: false });
    expect(passport.continents.map((group) => group.id)).toEqual(['europe', 'asia', 'americas']);
    expect(passport.continents[0]?.countries.map((item) => item.id)).toEqual(['fr', 'it']);
  });

  it('orders the dishes of a country by level: weekday, weekend, challenge', () => {
    const passport = buildPassport({ countries, dishes, cooks: [], subscribed: false });
    const italy = passport.continents[0]?.countries[1];
    expect(italy?.dishes.map((item) => item.dishId)).toEqual(['it-a', 'it-b', 'it-c']);
  });

  it('marks passed countries with the first stamp and cooked dishes, and counts all cooks', () => {
    const passport = buildPassport({
      countries,
      dishes,
      cooks: [
        cook('it-b', 'it', '2026-10-01T18:00:00Z'),
        cook('it-a', 'it', '2026-09-20T18:00:00Z'),
        cook('it-b', 'it', '2026-10-05T18:00:00Z'),
      ],
      subscribed: false,
    });
    const italy = passport.continents[0]?.countries.find((item) => item.id === 'it');
    const france = passport.continents[0]?.countries.find((item) => item.id === 'fr');
    expect(italy).toMatchObject({ passed: true, firstStampAt: '2026-09-20T18:00:00Z' });
    expect(italy?.dishes.map((item) => item.cooked)).toEqual([true, true, false]);
    expect(france).toMatchObject({ passed: false, firstStampAt: null });
    expect(passport).toMatchObject({ countriesCount: 1, countriesTotal: 4, dishesCount: 3 });
  });

  it('locks new countries of a free user with 10 passed countries, but never a passed one', () => {
    const passport = buildPassport({ ...tenPassed(), subscribed: false });
    const all = passport.continents.flatMap((group) => group.countries);
    expect(all.filter((item) => item.locked).map((item) => item.id)).toEqual(['x']);
    expect(passport.countriesCount).toBe(10);
  });

  it('opens every country with a subscription or with fewer than 10 passed countries', () => {
    const subscribed = buildPassport({ ...tenPassed(), subscribed: true });
    expect(subscribed.continents.flatMap((group) => group.countries).some((c) => c.locked)).toBe(
      false,
    );
    const nine = tenPassed();
    const free = buildPassport({ ...nine, cooks: nine.cooks.slice(1), subscribed: false });
    expect(free.continents.flatMap((group) => group.countries).some((c) => c.locked)).toBe(false);
  });

  it('builds a response that passes its schema', () => {
    const passport = buildPassport({
      countries,
      dishes,
      cooks: [cook('pe-a', 'pe', '2026-10-01T18:00:00+03:00')],
      subscribed: false,
    });
    expect(mapResponseSchema.safeParse(passport).success).toBe(true);
  });
});

describe('countrySchema', () => {
  it('accepts only the continents of the map', () => {
    const base = { id: 'pe', nameRu: 'Перу', sort: 1 };
    expect(countrySchema.safeParse({ ...base, continent: 'americas' }).success).toBe(true);
    expect(countrySchema.safeParse({ ...base, continent: 'south_america' }).success).toBe(false);
  });
});
