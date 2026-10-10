import type { MapResponse } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { continentProgress, findCountry, formatStampDate } from './passport.ts';

const country = (id: string, passed: boolean) => ({
  id,
  name: id,
  passed,
  locked: false,
  firstStampAt: null,
  dishes: [],
});

const europe: MapResponse['continents'][number] = {
  id: 'europe',
  countries: [country('it', true), country('fr', false)],
};

const map: MapResponse = {
  countriesCount: 1,
  countriesTotal: 3,
  dishesCount: 2,
  continents: [
    europe,
    { id: 'asia', countries: [country('jp', false)] },
  ],
};

describe('continentProgress', () => {
  it('counts the passed countries of the group', () => {
    expect(continentProgress(europe)).toEqual({ passed: 1, total: 2 });
  });
});

describe('findCountry', () => {
  it('finds a country with its continent, or nothing', () => {
    expect(findCountry(map, 'jp')).toMatchObject({ continent: 'asia', country: { id: 'jp' } });
    expect(findCountry(map, 'xx')).toBeUndefined();
  });
});

describe('formatStampDate', () => {
  const now = new Date('2026-10-10T12:00:00Z');

  it('shows day and month in the user zone, the year only for an earlier year', () => {
    expect(formatStampDate('2026-10-01T22:30:00Z', 'Europe/Moscow', now)).toBe('2 октября');
    expect(formatStampDate('2026-10-01T22:30:00Z', 'America/New_York', now)).toBe('1 октября');
    expect(formatStampDate('2025-03-08T12:00:00Z', 'Europe/Moscow', now)).toBe('8 марта 2025 г.');
  });

  it('falls back to the device zone for an unknown zone', () => {
    expect(formatStampDate('2026-06-15T12:00:00Z', 'Mars/Base', now)).toMatch(/июня/);
  });
});
