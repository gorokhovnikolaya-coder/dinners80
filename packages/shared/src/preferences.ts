import {
  CUSTOM_EXCLUSION_MAX_LENGTH,
  CUSTOM_EXCLUSION_MIN_LENGTH,
  CUSTOM_EXCLUSIONS_MAX,
  DISH_TAGS,
  type DishTag,
  type Household,
  type WeekdayMinutes,
} from './constants.ts';

/** Canonical list of tag exclusions to store: unique, in `DISH_TAGS` order. */
export function normalizeExclusions(exclusions: readonly DishTag[]): DishTag[] {
  return DISH_TAGS.filter((tag) => exclusions.includes(tag));
}

/**
 * A user's own exclusion as stored and shown: trimmed, inner whitespace collapsed to one space,
 * lower case (`'  Кинза  '` → `'кинза'`). `ё` is kept for display.
 */
export function cleanCustomExclusion(raw: string): string {
  return raw.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Comparison key of a word or a dish text: cleaned and `ё` → `е` (`'Свёкла'` → `'свекла'`). */
export function customExclusionKey(text: string): string {
  return cleanCustomExclusion(text).replaceAll('ё', 'е');
}

/** True for a cleaned own exclusion within the limits: 2–40 characters with at least one letter. */
export function isValidCustomExclusion(word: string): boolean {
  return (
    word.length >= CUSTOM_EXCLUSION_MIN_LENGTH &&
    word.length <= CUSTOM_EXCLUSION_MAX_LENGTH &&
    /\p{L}/u.test(word)
  );
}

/**
 * Canonical list of own exclusions to store: cleaned, without empty or invalid words and without
 * repeats by `customExclusionKey` (the first spelling wins), at most `CUSTOM_EXCLUSIONS_MAX`.
 */
export function normalizeCustomExclusions(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of words) {
    const word = cleanCustomExclusion(raw);
    const key = customExclusionKey(word);
    if (!isValidCustomExclusion(word) || seen.has(key)) continue;
    seen.add(key);
    result.push(word);
  }
  return result.slice(0, CUSTOM_EXCLUSIONS_MAX);
}

/** Why a word cannot be added to the own exclusions. */
export type CustomExclusionError =
  'empty' | 'tooShort' | 'tooLong' | 'noLetter' | 'duplicate' | 'limit';

/**
 * Adds a typed word to the own exclusions (the «Своё» field): the new list, or why it cannot be
 * added. The word is cleaned (`cleanCustomExclusion`); a repeat is detected by `customExclusionKey`.
 */
export function addCustomExclusion(
  list: readonly string[],
  raw: string,
): { list: string[] } | { error: CustomExclusionError } {
  const word = cleanCustomExclusion(raw);
  if (word.length === 0) return { error: 'empty' };
  if (word.length < CUSTOM_EXCLUSION_MIN_LENGTH) return { error: 'tooShort' };
  if (word.length > CUSTOM_EXCLUSION_MAX_LENGTH) return { error: 'tooLong' };
  if (!/\p{L}/u.test(word)) return { error: 'noLetter' };
  const key = customExclusionKey(word);
  if (list.some((item) => customExclusionKey(item) === key)) return { error: 'duplicate' };
  if (list.length >= CUSTOM_EXCLUSIONS_MAX) return { error: 'limit' };
  return { list: [...list, word] };
}

/** What `matchesCustomExclusion` looks at: the dish title and the names of its ingredients. */
export interface CustomExclusionTarget {
  title: string;
  ingredients: readonly { name: string }[];
}

/**
 * True if the dish is excluded by one of the user's own words: a word occurs (as a substring,
 * case-insensitive, `ё` = `е`, whitespace trimmed and collapsed) in the dish title or in the name
 * of one of its ingredients. Used by the suggestion algorithm; own exclusions are never relaxed,
 * like the tag ones.
 */
export function matchesCustomExclusion(
  dish: CustomExclusionTarget,
  words: readonly string[],
): boolean {
  const keys = words.map(customExclusionKey).filter((key) => key.length > 0);
  if (keys.length === 0) return false;
  const texts = [dish.title, ...dish.ingredients.map((ingredient) => ingredient.name)].map(
    customExclusionKey,
  );
  return keys.some((key) => texts.some((text) => text.includes(key)));
}

/** Onboarding answers that are required: who eats and the weekday dinner time. */
export interface OnboardingAnswers {
  household: Household | null;
  weekdayMinutes: WeekdayMinutes | null;
}

/**
 * The onboarding is complete once the required answers are saved. The server sets
 * `users.onboarded_at` the first time this becomes true; `needsOnboarding` is
 * `onboarded_at IS NULL`.
 */
export function hasOnboardingAnswers(answers: OnboardingAnswers): boolean {
  return answers.household !== null && answers.weekdayMinutes !== null;
}
