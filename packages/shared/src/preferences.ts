import { DISH_TAGS, type DishTag, type Household, type WeekdayMinutes } from './constants.ts';

/**
 * Exclusions implied by another one. Pork is meat too (every pork dish is tagged both `pork` and
 * `meat`), so excluding meat already excludes pork.
 */
export const IMPLIED_EXCLUSIONS: Readonly<Partial<Record<DishTag, readonly DishTag[]>>> = {
  meat: ['pork'],
};

/** True if `tag` is already excluded by another selected exclusion (pork when meat is selected). */
export function isExclusionImplied(tag: DishTag, exclusions: readonly DishTag[]): boolean {
  return exclusions.some((other) => other !== tag && IMPLIED_EXCLUSIONS[other]?.includes(tag));
}

/**
 * Canonical list of exclusions to store: unique, in `DISH_TAGS` order, without tags implied by
 * another selected one (`['pork', 'meat']` → `['meat']`).
 */
export function normalizeExclusions(exclusions: readonly DishTag[]): DishTag[] {
  return DISH_TAGS.filter(
    (tag) => exclusions.includes(tag) && !isExclusionImplied(tag, exclusions),
  );
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
