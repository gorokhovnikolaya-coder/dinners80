import { z } from 'zod/mini';

import { SERVINGS_MAX, SERVINGS_MIN } from './constants.ts';

/**
 * Body of `POST /api/shopping`: ingredients of a dish to buy, for the chosen servings (the dish
 * card's cart button sends the ones not marked «есть дома»). The server replaces the dish's
 * unchecked items with these, so adding a dish again does not duplicate it; bought (checked)
 * items stay.
 */
export const addShoppingRequestSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  servings: z.int().check(z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX)),
  /** `dish_ingredients.key` of the dish; unique, at least one. */
  ingredientKeys: z.array(z.string().check(z.minLength(1))).check(
    z.minLength(1),
    z.refine((keys) => new Set(keys).size === keys.length, 'Duplicate ingredient keys'),
  ),
});
export type AddShoppingRequest = z.infer<typeof addShoppingRequestSchema>;

/** Response of `POST /api/shopping`: how many items of the dish are now in the list. */
export const addShoppingResponseSchema = z.object({
  added: z.int().check(z.positive()),
});
export type AddShoppingResponse = z.infer<typeof addShoppingResponseSchema>;
