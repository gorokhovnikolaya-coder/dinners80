import { z } from 'zod/mini';

import { DISH_LEVELS } from './constants.ts';
import { SUGGESTION_MODES } from './suggestions.ts';

/** Query of `GET /api/home`: `mode=weekday|weekend&page=0`. */
export const homeQuerySchema = z.object({
  mode: z.enum(SUGGESTION_MODES),
  page: z.catch(z.coerce.number().check(z.int(), z.nonnegative()), 0),
});
export type HomeQuery = z.infer<typeof homeQuerySchema>;

/** The mark of a card (see `SuggestionLabel`). */
export const suggestionLabelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('newCountry') }),
  z.object({ kind: z.literal('nthDish'), n: z.int().check(z.positive()) }),
  z.object({ kind: z.literal('cookedBefore') }),
]);

/**
 * A card on the main screen. Only what the card shows — for a locked dish this is the same
 * preview as the paywall gets (country, title, photo), never ingredients or steps.
 */
export const suggestionCardSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  countryId: z.string().check(z.minLength(1)),
  countryName: z.string().check(z.minLength(1)),
  level: z.enum(DISH_LEVELS),
  minutes: z.int().check(z.positive()),
  /** URL of the content photo (WebP). */
  imageUrl: z.string().check(z.minLength(1)),
  label: suggestionLabelSchema,
  locked: z.boolean(),
});
export type SuggestionCard = z.infer<typeof suggestionCardSchema>;

/** Response of `GET /api/home`: a page of suggestions and the counters of the header. */
export const homeResponseSchema = z.object({
  mode: z.enum(SUGGESTION_MODES),
  page: z.int().check(z.nonnegative()),
  pageCount: z.int().check(z.positive()),
  suggestions: z.array(suggestionCardSchema),
  /** Passed countries of the user. */
  countriesCount: z.int().check(z.nonnegative()),
  /** Published countries («N из 30 стран»). */
  countriesTotal: z.int().check(z.nonnegative()),
  /** Cooks of the user (repeats included). */
  dishesCount: z.int().check(z.nonnegative()),
});
export type HomeResponse = z.infer<typeof homeResponseSchema>;
