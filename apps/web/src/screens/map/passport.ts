import type { MapContinent, MapCountry, MapResponse } from '@tma80/shared';

/** Passed and all countries of a continent group, for «3 из 8». */
export function continentProgress(group: MapContinent): { passed: number; total: number } {
  return {
    passed: group.countries.filter((country) => country.passed).length,
    total: group.countries.length,
  };
}

/** The country and its continent from the `GET /map` response, by id. */
export function findCountry(
  map: MapResponse,
  id: string,
): { country: MapCountry; continent: MapContinent['id'] } | undefined {
  for (const group of map.continents) {
    const country = group.countries.find((item) => item.id === id);
    if (country) return { country, continent: group.id };
  }
  return undefined;
}

const dateParts = (date: Date, timezone: string | undefined, withYear: boolean) => {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  };
  try {
    return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: timezone }).format(date);
  } catch {
    // An unknown zone (should not happen: the server validates it) — the device's zone.
    return new Intl.DateTimeFormat('ru-RU', options).format(date);
  }
};

const yearIn = (date: Date, timezone: string | undefined) => {
  try {
    return new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: timezone }).format(date);
  } catch {
    return String(date.getFullYear());
  }
};

/**
 * Date of the first stamp in the user's time zone: «12 октября» this year, «12 октября 2025 г.»
 * for an earlier one.
 */
export function formatStampDate(iso: string, timezone: string | undefined, now: Date): string {
  const date = new Date(iso);
  return dateParts(date, timezone, yearIn(date, timezone) !== yearIn(now, timezone));
}
