import { SERVINGS_MAX, SERVINGS_MIN, type Household, type IngredientUnit } from './constants.ts';

/** Servings the dish card opens with, by «who eats» (onboarding step 1). */
export const HOUSEHOLD_SERVINGS: Readonly<Record<Household, number>> = {
  solo: 1,
  couple: 2,
  family: 4,
};

/** Default servings when «who eats» is unknown (onboarding not finished). */
export const FALLBACK_SERVINGS = 2;

export function defaultServings(household: Household | null): number {
  return household === null ? FALLBACK_SERVINGS : HOUSEHOLD_SERVINGS[household];
}

/** Servings limited to 1–8 and made whole. */
export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return SERVINGS_MIN;
  return Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, Math.round(servings)));
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Rounds a recalculated amount so a cook can measure it:
 * - grams and millilitres: whole below 10, step 5 below 100, step 10 from 100; at least 1;
 * - pieces, table- and teaspoons: step 0.5, at least 0.5;
 * - cloves and pinches: whole, at least 1.
 * The step is chosen by the exact value, then the result is rounded half up
 * (97.5 g → step 5 → 100 g).
 */
export function roundAmount(value: number, unit: IngredientUnit): number {
  switch (unit) {
    case 'g':
    case 'ml': {
      const step = value < 10 ? 1 : value < 100 ? 5 : 10;
      return Math.max(1, roundTo(value, step));
    }
    case 'pcs':
    case 'tbsp':
    case 'tsp':
      return Math.max(0.5, roundTo(value, 0.5));
    case 'clove':
    case 'pinch':
      return Math.max(1, Math.round(value));
  }
}

/** What `scaleAmount` needs of an ingredient: its amount for `baseServings` and its unit. */
export interface ScalableAmount {
  /** `null` — «по вкусу» (to taste): never recalculated. */
  amount: number | null;
  unit: IngredientUnit | null;
}

/**
 * The amount of an ingredient for `servings`, recalculated from the dish's `baseServings` and
 * rounded (`roundAmount`). «To taste» stays `null`. The client and the server use the same
 * function, so the card, the cooking mode and the shopping list show the same numbers.
 */
export function scaleAmount(
  ingredient: ScalableAmount,
  baseServings: number,
  servings: number,
): number | null {
  if (ingredient.amount === null || ingredient.unit === null) return null;
  if (servings === baseServings) return ingredient.amount;
  return roundAmount((ingredient.amount * servings) / baseServings, ingredient.unit);
}
