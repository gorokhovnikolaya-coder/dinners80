import {
  FREE_COUNTRIES_LIMIT,
  type DishLevel,
  type DishTag,
  type WeekdayMinutes,
} from './constants.ts';
import { matchesCustomExclusion } from './preferences.ts';

/** «Будни» or «Выходные» on the main screen (`GET /home?mode=`). */
export const SUGGESTION_MODES = ['weekday', 'weekend'] as const;
export type SuggestionMode = (typeof SUGGESTION_MODES)[number];

/** Suggestions per page: one big card and two small ones. */
export const SUGGESTIONS_PER_PAGE = 3;

/** A dish cooked within this many days is not suggested again (until the rule is relaxed). */
export const RECENT_COOK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Levels shown in each mode: weekdays — «будний вечер»; weekends — «выходные» and «вызов». */
export const MODE_LEVELS: Readonly<Record<SuggestionMode, readonly DishLevel[]>> = {
  weekday: ['weekday'],
  weekend: ['weekend', 'challenge'],
};

/** What the algorithm needs to know about a dish: tags, title and ingredient names, time. */
export interface SuggestionDish {
  id: string;
  countryId: string;
  title: string;
  level: DishLevel;
  minutes: number;
  tags: readonly DishTag[];
  ingredients: readonly { name: string }[];
}

/** A cook of the user (`cooks`): the dish, its country and when. */
export interface SuggestionCook {
  dishId: string;
  countryId: string;
  /** ISO date-time. */
  createdAt: string;
}

export interface SuggestionUser {
  /** `users.id`: part of the daily seed. */
  id: string;
  exclusions: readonly DishTag[];
  customExclusions: readonly string[];
  /** Weekday time limit; `null` (not onboarded) — no limit. */
  weekdayMinutes: WeekdayMinutes | null;
  /** IANA time zone: the seed date and the default mode follow the user's day. */
  timezone: string;
  /** Has an active subscription. */
  subscribed: boolean;
}

export interface SuggestionInput {
  /** Published dishes of the content (with ingredient names). */
  dishes: readonly SuggestionDish[];
  /** All cooks of the user. */
  cooks: readonly SuggestionCook[];
  user: SuggestionUser;
  mode: SuggestionMode;
  /** Requested page; any integer, taken modulo the page count («Показать другие» goes round). */
  page: number;
  now: Date;
}

/**
 * The mark on a card: `newCountry` — the country is not passed yet; `nthDish` — the user's `n`-th
 * different dish of a passed country; `cookedBefore` — the user has cooked this very dish.
 */
export type SuggestionLabel =
  { kind: 'newCountry' } | { kind: 'nthDish'; n: number } | { kind: 'cookedBefore' };

export interface Suggestion {
  dishId: string;
  label: SuggestionLabel;
  /**
   * A dish of a new country for a free user with `FREE_COUNTRIES_LIMIT` passed countries: shown
   * last on the page with a lock, opens the paywall.
   */
  locked: boolean;
}

export interface SuggestionPage {
  /** The page actually shown (`input.page` modulo `pageCount`). */
  page: number;
  /** At least 1; «Показать другие» is shown only when there is more than one page. */
  pageCount: number;
  /** 0–3 cards: the first one is the big card; a locked card is always the last one. */
  suggestions: Suggestion[];
}

/** `YYYY-MM-DD` of `now` in the time zone (the user's «today»). */
export function localDateKey(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The mode the main screen opens with: weekends on Saturday and Sunday of the user's time zone. */
export function defaultSuggestionMode(now: Date, timezone: string): SuggestionMode {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(
    now,
  );
  return day === 'Sat' || day === 'Sun' ? 'weekend' : 'weekday';
}

/** 32-bit FNV-1a hash, then a murmur3 finaliser for a better spread of close strings. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Tie-break key of a dish: random-looking, but the same for the whole day of the user
 * (seed = local date + user id) and independent of the input order.
 */
export function dailyRank(seed: string, dishId: string): number {
  return hash32(`${seed}|${dishId}`);
}

/** True if the user's tag or own exclusions forbid the dish (never relaxed). */
export function isExcluded(
  dish: SuggestionDish,
  user: Pick<SuggestionUser, 'exclusions' | 'customExclusions'>,
): boolean {
  return (
    dish.tags.some((tag) => user.exclusions.includes(tag)) ||
    matchesCustomExclusion(dish, user.customExclusions)
  );
}

/**
 * Splits an ordered list into pages of `size`. Within a page a country is not repeated if
 * another dish can be taken instead: the first remaining dish of a country not yet on the page
 * is taken; a dish moves up only for that. The last, incomplete page is filled from the start
 * of the list (round), again preferring countries not on the page.
 */
function paginate<T extends { countryId: string; id: string }>(
  list: readonly T[],
  size: number,
): T[][] {
  const pages: T[][] = [];
  const rest = [...list];
  const pick = (page: T[], pool: T[]): T | undefined => {
    const countries = new Set(page.map((item) => item.countryId));
    const ids = new Set(page.map((item) => item.id));
    const candidates = pool.filter((item) => !ids.has(item.id));
    return candidates.find((item) => !countries.has(item.countryId)) ?? candidates[0];
  };
  while (rest.length > 0) {
    const page: T[] = [];
    while (page.length < size && rest.length > 0) {
      const item = pick(page, rest);
      if (!item) break;
      page.push(item);
      rest.splice(rest.indexOf(item), 1);
    }
    pages.push(page);
  }
  const last = pages.at(-1);
  if (pages.length > 1 && last && last.length < size) {
    while (last.length < size) {
      const item = pick(last, [...list]);
      if (!item) break;
      last.push(item);
    }
  }
  return pages;
}

/**
 * The suggestion algorithm of «Ужин сегодня» (ТЗ, экран 1; decision 0007).
 *
 * 1. Never relaxed: dishes with an excluded tag or an own exclusion; dishes of other levels than
 *    the mode's.
 * 2. Order: dishes of not-passed countries → not-yet-cooked dishes of passed countries → dishes
 *    cooked more than `RECENT_COOK_DAYS` days ago. Within a group — `dailyRank` (random, the same
 *    for the day). Dishes cooked within 14 days and, on weekdays, dishes longer than the user's
 *    time are left out.
 * 3. Only if fewer than a page of dishes is left, the rules are relaxed one by one, one dish at a
 *    time until the page is full: first recently cooked dishes (the oldest cook first), then on
 *    weekdays longer dishes (the closest time first).
 * 4. A free user with `FREE_COUNTRIES_LIMIT` passed countries gets dishes of passed countries only
 *    (2 per page) and a locked dish of a new country last on each page (the same order and
 *    relaxation of the time limit; one per page in turn).
 * 5. Pages (`paginate`): no repeated country on a page where possible; the last page is filled
 *    from the start; the requested page is taken modulo the page count.
 */
export function suggestDishes(input: SuggestionInput): SuggestionPage {
  const { dishes, cooks, user, mode, now } = input;
  const seed = `${localDateKey(now, user.timezone)}:${user.id}`;
  const rank = (dish: SuggestionDish) => dailyRank(seed, dish.id);

  const passed = new Set(cooks.map((cook) => cook.countryId));
  const lastCook = new Map<string, number>();
  for (const cook of cooks) {
    const time = Date.parse(cook.createdAt);
    lastCook.set(cook.dishId, Math.max(lastCook.get(cook.dishId) ?? -Infinity, time));
  }
  const cookedDishesByCountry = new Map<string, Set<string>>();
  for (const cook of cooks) {
    const set = cookedDishesByCountry.get(cook.countryId) ?? new Set<string>();
    set.add(cook.dishId);
    cookedDishesByCountry.set(cook.countryId, set);
  }

  const recentSince = now.getTime() - RECENT_COOK_DAYS * DAY_MS;
  const isRecent = (dish: SuggestionDish) => (lastCook.get(dish.id) ?? -Infinity) > recentSince;
  const limit = mode === 'weekday' ? user.weekdayMinutes : null;
  const fitsTime = (dish: SuggestionDish) => limit === null || dish.minutes <= limit;

  const eligible = dishes.filter(
    (dish) => MODE_LEVELS[mode].includes(dish.level) && !isExcluded(dish, user),
  );

  const locking = !user.subscribed && passed.size >= FREE_COUNTRIES_LIMIT;
  const open = locking ? eligible.filter((dish) => passed.has(dish.countryId)) : eligible;
  const closed = locking ? eligible.filter((dish) => !passed.has(dish.countryId)) : [];

  const byRank = (a: SuggestionDish, b: SuggestionDish) => rank(a) - rank(b);
  const group = (dish: SuggestionDish) =>
    !passed.has(dish.countryId) ? 0 : lastCook.has(dish.id) ? 2 : 1;

  const main = open
    .filter((dish) => !isRecent(dish) && fitsTime(dish))
    .sort((a, b) => group(a) - group(b) || byRank(a, b));

  const slots = closed.length > 0 ? SUGGESTIONS_PER_PAGE - 1 : SUGGESTIONS_PER_PAGE;
  if (main.length < slots) {
    const recent = open
      .filter((dish) => isRecent(dish) && fitsTime(dish))
      .sort((a, b) => (lastCook.get(a.id) ?? 0) - (lastCook.get(b.id) ?? 0) || byRank(a, b));
    main.push(...recent.slice(0, slots - main.length));
  }
  if (main.length < slots) {
    const longer = open
      .filter((dish) => !fitsTime(dish))
      .sort(
        (a, b) =>
          a.minutes - b.minutes ||
          Number(isRecent(a)) - Number(isRecent(b)) ||
          group(a) - group(b) ||
          byRank(a, b),
      );
    main.push(...longer.slice(0, slots - main.length));
  }

  const lockedList = [...closed].sort(
    (a, b) =>
      Number(!fitsTime(a)) - Number(!fitsTime(b)) ||
      (fitsTime(a) ? 0 : a.minutes - b.minutes) ||
      byRank(a, b),
  );

  const pages = paginate(main, slots);
  const pageCount = Math.max(pages.length, 1);
  const page = ((Math.trunc(input.page) % pageCount) + pageCount) % pageCount;

  const label = (dish: SuggestionDish): SuggestionLabel => {
    if (!passed.has(dish.countryId)) return { kind: 'newCountry' };
    if (lastCook.has(dish.id)) return { kind: 'cookedBefore' };
    return { kind: 'nthDish', n: (cookedDishesByCountry.get(dish.countryId)?.size ?? 0) + 1 };
  };

  const suggestions: Suggestion[] = (pages[page] ?? []).map((dish) => ({
    dishId: dish.id,
    label: label(dish),
    locked: false,
  }));
  const lockedDish = lockedList[page % Math.max(lockedList.length, 1)];
  if (lockedDish) {
    suggestions.push({ dishId: lockedDish.id, label: { kind: 'newCountry' }, locked: true });
  }

  return { page, pageCount, suggestions };
}
