import type { Cook } from '@tma80/shared';

import { dishes } from './dishes.ts';
import { FRIEND_IDS, TEST_USER_IDS, findUserByTgId } from './users.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `[dishId, daysAgo, withPhoto?]`: dates are relative to now, so the 14-day and "this week" rules
 * stay meaningful; `withPhoto` gives the cook a photo in the user's private folder.
 */
type CookSpec = readonly [dishId: string, daysAgo: number, withPhoto?: boolean];

/** A stable uuid of the n-th fixture photo, for `cooks/{user_id}/{uuid}.jpg`. */
const photoUuid = (tgId: number, n: number) =>
  `00000000-0000-4000-9000-${String(tgId * 100 + n).padStart(12, '0')}`;

const cooksOf = (tgId: number, specs: readonly CookSpec[]): Cook[] => {
  const user = findUserByTgId(tgId);
  if (!user) throw new Error(`Fixture user ${String(tgId)} not found`);
  return specs.map(([dishId, daysAgo, withPhoto = false], index) => {
    const dish = dishes.find((item) => item.id === dishId);
    if (!dish) throw new Error(`Fixture dish ${dishId} not found`);
    return {
      id: `${String(tgId)}-${String(index + 1)}`,
      userId: user.profile.id,
      dishId,
      countryId: dish.countryId,
      photoPath: withPhoto ? `cooks/${user.profile.id}/${photoUuid(tgId, index + 1)}.jpg` : null,
      createdAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    };
  });
};

export const cooks: Cook[] = [
  // Борис — 8 countries, excludes pork with the own word «свин».
  ...cooksOf(TEST_USER_IDS.eightCountries, [
    ['it-lasagna', 60],
    ['fr-omelette', 45],
    ['es-tortilla', 40],
    ['gr-horiatiki', 30],
    ['fr-ratatouille', 21],
    ['jp-oyakodon', 15],
    ['pe-lomo-saltado', 9],
    ['br-moqueca', 5],
    ['jp-oyakodon', 3],
    ['co-arepas', 1],
  ]),
  // Вера — 10 countries, no Thailand and Colombia.
  ...cooksOf(TEST_USER_IDS.tenCountriesFree, [
    ['it-carbonara', 80],
    ['fr-omelette', 70],
    ['es-gazpacho', 60],
    ['gr-moussaka', 52],
    ['jp-oyakodon', 44],
    ['cn-kung-pao', 33],
    ['in-dal', 25],
    ['pe-lomo-saltado', 18],
    ['it-carbonara', 12],
    ['ar-choripan', 6],
    ['br-moqueca', 2],
  ]),
  // Глеб — 10 countries, excludes pork with the own word «свин»: no India and Thailand.
  ...cooksOf(TEST_USER_IDS.tenCountriesSubscribed, [
    ['it-lasagna', 90],
    ['fr-omelette', 75],
    ['es-gazpacho', 64],
    ['gr-horiatiki', 50],
    ['jp-oyakodon', 41],
    ['cn-kung-pao', 35],
    ['pe-lomo-saltado', 27],
    ['ar-empanadas', 20],
    ['br-pao-de-queijo', 11],
    ['co-arepas', 4],
    ['jp-ramen', 2],
  ]),
  // Дина — 3 countries, excludes meat.
  ...cooksOf(TEST_USER_IDS.botCannotWrite, [
    ['fr-ratatouille', 20],
    ['es-tortilla', 10],
    ['br-pao-de-queijo', 4],
  ]),
  // Егор — 5 countries.
  ...cooksOf(FRIEND_IDS.egor, [
    ['it-carbonara', 30],
    ['jp-oyakodon', 22],
    ['cn-kung-pao', 14],
    ['th-pad-kra-pao', 6, true],
    ['pe-lomo-saltado', 1, true],
  ]),
  // Жанна — 8 countries, excludes gluten (Italy, Greece, Japan, China have no gluten-free dish).
  ...cooksOf(FRIEND_IDS.zhanna, [
    ['fr-ratatouille', 60],
    ['es-tortilla', 50],
    ['in-dal', 40],
    ['th-green-curry', 30],
    ['pe-ceviche', 20],
    ['ar-asado', 10],
    ['br-moqueca', 3],
    ['co-arepas', 2, true],
    ['es-paella', 1],
  ]),
  // Зоя — 11 countries, yearly subscription.
  ...cooksOf(FRIEND_IDS.zoya, [
    ['it-lasagna', 100],
    ['fr-bourguignon', 90],
    ['es-paella', 80],
    ['gr-spanakopita', 70],
    ['jp-gyoza', 60],
    ['cn-jiaozi', 50],
    ['in-biryani', 40],
    ['th-massaman', 30],
    ['pe-ceviche', 20],
    ['ar-asado', 8, true],
    ['co-sancocho', 1],
  ]),
];

/** Number of passed countries: a country is passed if the user has at least one cook there. */
export const countCountries = (userId: string): number =>
  new Set(cooks.filter((cook) => cook.userId === userId).map((cook) => cook.countryId)).size;
