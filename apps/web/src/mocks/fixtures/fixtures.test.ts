import {
  DISH_LEVELS,
  FREE_COUNTRIES_LIMIT,
  cookSchema,
  countrySchema,
  dishSchema,
  matchesCustomExclusion,
  userProfileSchema,
  subscriptionStatusSchema,
} from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { cooks, countCountries } from './cooks.ts';
import { countries } from './countries.ts';
import { dishes } from './dishes.ts';
import { FRIEND_IDS, TEST_USER_IDS, findUserByTgId, friendships, users } from './users.ts';

const userByTgId = (tgId: number) => {
  const user = findUserByTgId(tgId);
  if (!user) throw new Error(`No fixture user ${String(tgId)}`);
  return user;
};

describe('content fixtures', () => {
  it('match the shared schemas', () => {
    for (const country of countries) expect(countrySchema.parse(country)).toEqual(country);
    for (const dish of dishes) expect(dishSchema.parse(dish)).toEqual(dish);
    for (const cook of cooks) expect(cookSchema.parse(cook)).toEqual(cook);
  });

  it('have 12 countries on 3 continents', () => {
    expect(countries).toHaveLength(12);
    expect(new Set(countries.map((country) => country.continent)).size).toBe(3);
    expect(new Set(countries.map((country) => country.id)).size).toBe(12);
  });

  it('have 36 dishes: one of each level per country', () => {
    expect(dishes).toHaveLength(36);
    expect(new Set(dishes.map((dish) => dish.id)).size).toBe(36);
    for (const country of countries) {
      const levels = dishes
        .filter((dish) => dish.countryId === country.id)
        .map((dish) => dish.level);
      expect(levels.toSorted()).toEqual([...DISH_LEVELS].toSorted());
    }
  });

  it('keep weekday dishes within the longest weekday time', () => {
    for (const dish of dishes.filter((item) => item.level === 'weekday')) {
      expect(dish.minutes).toBeLessThanOrEqual(45);
    }
  });
});

describe('user fixtures', () => {
  it('match the shared schemas and have unique ids', () => {
    for (const user of users) {
      expect(userProfileSchema.parse(user.profile)).toEqual(user.profile);
      expect(subscriptionStatusSchema.parse(user.subscription)).toEqual(user.subscription);
      expect(user.profile.tgId).toBe(user.tg.id);
    }
    expect(new Set(users.map((user) => user.tg.id)).size).toBe(users.length);
  });

  it('cover the states from the spec', () => {
    const newbie = userByTgId(TEST_USER_IDS.newbie);
    expect(newbie.onboarded).toBe(false);
    expect(countCountries(newbie.profile.id)).toBe(0);

    expect(countCountries(userByTgId(TEST_USER_IDS.eightCountries).profile.id)).toBe(8);

    const free = userByTgId(TEST_USER_IDS.tenCountriesFree);
    expect(countCountries(free.profile.id)).toBe(FREE_COUNTRIES_LIMIT);
    expect(free.subscription.active).toBe(false);

    const subscribed = userByTgId(TEST_USER_IDS.tenCountriesSubscribed);
    expect(countCountries(subscribed.profile.id)).toBe(FREE_COUNTRIES_LIMIT);
    expect(subscribed.subscription.active).toBe(true);

    const silent = userByTgId(TEST_USER_IDS.botCannotWrite);
    expect(silent.profile.botCanWrite).toBe(false);
    expect(silent.tg.allows_write_to_pm).toBe(false);
    expect(silent.profile.reminderEnabled).toBe(false);
  });

  it('leave a locked country with an allowed dish for the "10 countries" states', () => {
    expect(countries.length).toBeGreaterThan(FREE_COUNTRIES_LIMIT);
    for (const tgId of [TEST_USER_IDS.tenCountriesFree, TEST_USER_IDS.tenCountriesSubscribed]) {
      const user = userByTgId(tgId);
      const passed = new Set(
        cooks.filter((cook) => cook.userId === user.profile.id).map((cook) => cook.countryId),
      );
      const available = dishes.filter(
        (dish) =>
          !passed.has(dish.countryId) &&
          !dish.tags.some((tag) => user.profile.exclusions.includes(tag)),
      );
      expect(available.length, `user ${String(tgId)}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('have 3 friends, each a friend of the test users with progress', () => {
    const friendIds: number[] = Object.values(FRIEND_IDS);
    expect(friendIds).toHaveLength(3);
    for (const [a, b] of friendships) {
      expect(findUserByTgId(a)).toBeDefined();
      expect(findUserByTgId(b)).toBeDefined();
    }
    const friendsOf = (tgId: number) => friendships.filter(([a]) => a === tgId).map(([, b]) => b);
    expect(friendsOf(TEST_USER_IDS.newbie)).toEqual([]);
    expect(friendsOf(TEST_USER_IDS.eightCountries).toSorted()).toEqual(friendIds.toSorted());
  });

  it('only cook dishes allowed by the user exclusions', () => {
    for (const cook of cooks) {
      const user = users.find((item) => item.profile.id === cook.userId);
      const dish = dishes.find((item) => item.id === cook.dishId);
      expect(user && dish).toBeTruthy();
      const excluded = dish?.tags.filter((tag) => user?.profile.exclusions.includes(tag));
      expect(excluded, `${cook.dishId} for ${String(user?.tg.id)}`).toEqual([]);
      // Mock dishes have no ingredients: own exclusions are checked against the title.
      const custom =
        dish && user
          ? matchesCustomExclusion({ ...dish, ingredients: [] }, user.profile.customExclusions)
          : false;
      expect(custom, `${cook.dishId} for ${String(user?.tg.id)}`).toBe(false);
    }
  });
});
