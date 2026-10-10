import { z } from 'zod/mini';

import { CONTINENTS, DISH_LEVELS, type Continent, type DishLevel } from './constants.ts';
import { hasCountryAccess } from './dish.ts';

/** A dish of a country on the map: what its row shows, and whether the user has cooked it. */
export const mapDishSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  level: z.enum(DISH_LEVELS),
  minutes: z.int().check(z.positive()),
  /** URL of the content photo (WebP). */
  imageUrl: z.string().check(z.minLength(1)),
  cooked: z.boolean(),
});
export type MapDish = z.infer<typeof mapDishSchema>;

/** A country of the passport. */
export const mapCountrySchema = z.object({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  /** At least one cook of a dish of this country (a stamp). */
  passed: z.boolean(),
  /** No access by `has_access`: its dishes open the paywall. */
  locked: z.boolean(),
  /** Time of the first cook of the country (the stamp); `null` if not passed. */
  firstStampAt: z.nullable(z.iso.datetime({ offset: true })),
  dishes: z.array(mapDishSchema),
});
export type MapCountry = z.infer<typeof mapCountrySchema>;

/** A continent group of the map; only continents with published countries are sent. */
export const mapContinentSchema = z.object({
  id: z.enum(CONTINENTS),
  countries: z.array(mapCountrySchema),
});
export type MapContinent = z.infer<typeof mapContinentSchema>;

/** Response of `GET /api/map`: the passport counters and the countries by continent. */
export const mapResponseSchema = z.object({
  /** Passed countries of the user. */
  countriesCount: z.int().check(z.nonnegative()),
  /** Published countries («8 / 30»). */
  countriesTotal: z.int().check(z.nonnegative()),
  /** Cooks of the user (repeats included). */
  dishesCount: z.int().check(z.nonnegative()),
  continents: z.array(mapContinentSchema),
});
export type MapResponse = z.infer<typeof mapResponseSchema>;

/** A published country as `buildPassport` needs it. */
export interface PassportCountry {
  id: string;
  name: string;
  continent: Continent;
  sort: number;
}

/** A published dish as `buildPassport` needs it. */
export interface PassportDish {
  id: string;
  countryId: string;
  title: string;
  level: DishLevel;
  minutes: number;
  imageUrl: string;
}

/** A cook of the user as `buildPassport` needs it. */
export interface PassportCook {
  dishId: string;
  countryId: string;
  createdAt: string;
}

export interface PassportInput {
  countries: readonly PassportCountry[];
  dishes: readonly PassportDish[];
  /** All cooks of the user, repeats included. */
  cooks: readonly PassportCook[];
  /** The user has an active subscription. */
  subscribed: boolean;
}

/**
 * `GET /map` as the server builds it: continents in the order of `CONTINENTS` (empty ones left
 * out), countries by `sort` (so a new stamp does not move the tiles), dishes by level (weekday,
 * weekend, challenge). A country is passed if it has a cook; locked if `has_access` denies it.
 */
export function buildPassport({
  countries,
  dishes,
  cooks,
  subscribed,
}: PassportInput): MapResponse {
  const firstStamp = new Map<string, string>();
  for (const cook of cooks) {
    const known = firstStamp.get(cook.countryId);
    if (known === undefined || Date.parse(cook.createdAt) < Date.parse(known))
      firstStamp.set(cook.countryId, cook.createdAt);
  }
  const passed = new Set(firstStamp.keys());
  const cookedDishes = new Set(cooks.map((cook) => cook.dishId));
  const levelOrder = (level: DishLevel) => DISH_LEVELS.indexOf(level);

  const continents = CONTINENTS.flatMap((continent) => {
    const group = countries
      .filter((country) => country.continent === continent)
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
      .map((country): MapCountry => ({
        id: country.id,
        name: country.name,
        passed: passed.has(country.id),
        locked: !hasCountryAccess(country.id, passed, subscribed),
        firstStampAt: firstStamp.get(country.id) ?? null,
        dishes: dishes
          .filter((dish) => dish.countryId === country.id)
          .sort(
            (a, b) =>
              levelOrder(a.level) - levelOrder(b.level) || a.title.localeCompare(b.title, 'ru'),
          )
          .map((dish) => ({
            dishId: dish.id,
            title: dish.title,
            level: dish.level,
            minutes: dish.minutes,
            imageUrl: dish.imageUrl,
            cooked: cookedDishes.has(dish.id),
          })),
      }));
    return group.length > 0 ? [{ id: continent, countries: group }] : [];
  });

  return {
    countriesCount: countries.filter((country) => passed.has(country.id)).length,
    countriesTotal: countries.length,
    dishesCount: cooks.length,
    continents,
  };
}
