import { z } from 'zod/mini';

import {
  AISLES,
  DISH_LEVELS,
  FREE_COUNTRIES_LIMIT,
  INGREDIENT_UNITS,
  SERVINGS_MAX,
  SERVINGS_MIN,
} from './constants.ts';
import { suggestionLabelSchema } from './home.ts';

const servingsSchema = z.int().check(z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX));

/**
 * Query of `GET /api/dishes/:id?servings=2`. Without `servings` (or with an invalid value) the
 * server takes the default by «who eats» (`defaultServings`).
 */
export const dishQuerySchema = z.object({
  servings: z.catch(
    z.optional(z.coerce.number().check(z.int(), z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX))),
    undefined,
  ),
});
export type DishQuery = z.infer<typeof dishQuerySchema>;

/** An ingredient of a dish (`dish_ingredients`) with its amount for the requested servings. */
export const dishIngredientSchema = z
  .object({
    /** Unique within the dish; steps refer to it as `{key}`. */
    key: z.string().check(z.regex(/^[a-z0-9_]+$/)),
    /** Common product key: the shopping list sums the same product with the same unit. */
    product: z.string().check(z.regex(/^[a-z0-9_]+$/)),
    name: z.string().check(z.minLength(1)),
    /** Amount for `baseServings` as in the content; `null` — «по вкусу» (to taste). */
    baseAmount: z.nullable(z.number().check(z.positive())),
    /** Amount for the requested `servings` (`scaleAmount`); `null` — «по вкусу». */
    amount: z.nullable(z.number().check(z.positive())),
    /** `null` only together with a `null` amount. */
    unit: z.nullable(z.enum(INGREDIENT_UNITS)),
    aisle: z.enum(AISLES),
  })
  .check(
    z.refine(
      (item) =>
        (item.amount === null) === (item.unit === null) &&
        (item.baseAmount === null) === (item.unit === null),
      'An amount needs a unit; «to taste» has neither',
    ),
  );
export type DishIngredient = z.infer<typeof dishIngredientSchema>;

/** A step of the recipe (`dish_steps`); `text` has `{key}` placeholders of the ingredients. */
export const dishStepSchema = z.object({
  n: z.int().check(z.positive()),
  text: z.string().check(z.minLength(1)),
  timerSeconds: z.nullable(z.int().check(z.positive())),
});
export type DishStep = z.infer<typeof dishStepSchema>;

/** Response of `GET /api/dishes/:id`: the dish card with ingredients and steps. */
export const dishResponseSchema = z.object({
  id: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  countryId: z.string().check(z.minLength(1)),
  countryName: z.string().check(z.minLength(1)),
  level: z.enum(DISH_LEVELS),
  minutes: z.int().check(z.positive()),
  description: z.string(),
  fact: z.string(),
  /** URL of the content photo. */
  imageUrl: z.string().check(z.minLength(1)),
  /** The same mark as on the main screen («Новая страна» / «N-е блюдо» / «Уже готовили»). */
  label: suggestionLabelSchema,
  /** Servings of the content amounts (`baseAmount`). */
  baseServings: servingsSchema,
  /** Servings of `amount` (the requested or the default ones). */
  servings: servingsSchema,
  ingredients: z.array(dishIngredientSchema),
  steps: z.array(dishStepSchema),
});
export type DishResponse = z.infer<typeof dishResponseSchema>;

/** What the paywall gets of a closed dish: country, title and photo — no ingredients or steps. */
export const dishPreviewSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  countryId: z.string().check(z.minLength(1)),
  countryName: z.string().check(z.minLength(1)),
  imageUrl: z.string().check(z.minLength(1)),
});
export type DishPreview = z.infer<typeof dishPreviewSchema>;

/** `403` of `GET /api/dishes/:id` when the user has no access to the country. */
export const paywallErrorSchema = z.object({
  error: z.object({
    code: z.literal('paywall'),
    message: z.string(),
    preview: dishPreviewSchema,
  }),
});
export type PaywallError = z.infer<typeof paywallErrorSchema>;

/**
 * `has_access(user, country)`: the country is passed, or the user has fewer than
 * `FREE_COUNTRIES_LIMIT` passed countries, or an active subscription.
 */
export function hasCountryAccess(
  countryId: string,
  passedCountries: ReadonlySet<string>,
  subscribed: boolean,
): boolean {
  return (
    passedCountries.has(countryId) || passedCountries.size < FREE_COUNTRIES_LIMIT || subscribed
  );
}
