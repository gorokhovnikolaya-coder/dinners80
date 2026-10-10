import { z } from 'zod/mini';

import { CONTINENTS, DISH_LEVELS, DISH_TAGS } from './constants.ts';

/** A country of the content (`countries`). `id` is a slug, e.g. `pe`. */
export const countrySchema = z.object({
  id: z.string().check(z.regex(/^[a-z]{2,3}$/)),
  nameRu: z.string().check(z.minLength(1)),
  /** Continent group of the map (`CONTINENTS`), e.g. `europe`. */
  continent: z.enum(CONTINENTS),
  sort: z.int(),
});
export type Country = z.infer<typeof countrySchema>;

/** A dish without ingredients and steps (`dishes`). */
export const dishSchema = z.object({
  id: z.string().check(z.minLength(1)),
  countryId: z.string().check(z.minLength(1)),
  slug: z.string().check(z.regex(/^[a-z0-9-]+$/)),
  title: z.string().check(z.minLength(1)),
  level: z.enum(DISH_LEVELS),
  minutes: z.int().check(z.positive()),
  baseServings: z.int().check(z.positive()),
  description: z.string(),
  fact: z.string(),
  /** Path of the content photo relative to the media root. */
  imagePath: z.string().check(z.minLength(1)),
  tags: z.array(z.enum(DISH_TAGS)),
});
export type Dish = z.infer<typeof dishSchema>;

/** A cooked dish (`cooks`); repeats are allowed. A country is passed if it has at least one cook. */
export const cookSchema = z.object({
  id: z.string().check(z.minLength(1)),
  userId: z.string().check(z.minLength(1)),
  dishId: z.string().check(z.minLength(1)),
  countryId: z.string().check(z.minLength(1)),
  photoPath: z.nullable(z.string()),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Cook = z.infer<typeof cookSchema>;
