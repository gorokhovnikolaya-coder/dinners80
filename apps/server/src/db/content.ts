import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Continent, DishLevel, DishTag } from '@tma80/shared';

import type { Executor } from './users.ts';
import { countries, dishes, dishIngredients, dishSteps } from './schema.ts';

/** A published country. */
export interface ContentCountry {
  id: string;
  nameRu: string;
  continent: Continent;
  sort: number;
}

/** A published dish of a published country, with the names of its ingredients. */
export interface ContentDish {
  id: string;
  countryId: string;
  title: string;
  level: DishLevel;
  minutes: number;
  baseServings: number;
  description: string;
  fact: string;
  imagePath: string;
  tags: DishTag[];
  ingredients: { name: string }[];
}

/** Published content: what the user can see (unpublished rows stay only for old cooks). */
export interface PublishedContent {
  countries: ContentCountry[];
  dishes: ContentDish[];
}

/** Published countries by `sort`, and their published dishes with ingredient names. */
export async function loadPublishedContent(db: Executor): Promise<PublishedContent> {
  const countryRows = await db
    .select({
      id: countries.id,
      nameRu: countries.nameRu,
      continent: countries.continent,
      sort: countries.sort,
    })
    .from(countries)
    .where(eq(countries.isPublished, true))
    .orderBy(asc(countries.sort), asc(countries.id));
  const dishRows = await db
    .select({
      id: dishes.id,
      countryId: dishes.countryId,
      title: dishes.title,
      level: dishes.level,
      minutes: dishes.minutes,
      baseServings: dishes.baseServings,
      description: dishes.description,
      fact: dishes.fact,
      imagePath: dishes.imagePath,
      tags: dishes.tags,
    })
    .from(dishes)
    .innerJoin(countries, eq(countries.id, dishes.countryId))
    .where(and(eq(dishes.isPublished, true), eq(countries.isPublished, true)))
    .orderBy(asc(dishes.id));
  const ingredientRows =
    dishRows.length === 0
      ? []
      : await db
          .select({ dishId: dishIngredients.dishId, name: dishIngredients.name })
          .from(dishIngredients)
          .where(
            inArray(
              dishIngredients.dishId,
              dishRows.map((dish) => dish.id),
            ),
          )
          .orderBy(asc(dishIngredients.dishId), asc(dishIngredients.sort));
  const names = new Map<string, { name: string }[]>();
  for (const row of ingredientRows) {
    const list = names.get(row.dishId) ?? [];
    list.push({ name: row.name });
    names.set(row.dishId, list);
  }
  return {
    countries: countryRows,
    dishes: dishRows.map((dish) => ({
      ...dish,
      ingredients: names.get(dish.id) ?? [],
    })),
  };
}

/** A published dish of a published country with its country name, or `undefined`. */
export async function findPublishedDish(db: Executor, dishId: string) {
  const [row] = await db
    .select({
      id: dishes.id,
      countryId: dishes.countryId,
      countryName: countries.nameRu,
      title: dishes.title,
      level: dishes.level,
      minutes: dishes.minutes,
      baseServings: dishes.baseServings,
      description: dishes.description,
      fact: dishes.fact,
      imagePath: dishes.imagePath,
    })
    .from(dishes)
    .innerJoin(countries, eq(countries.id, dishes.countryId))
    .where(
      and(eq(dishes.id, dishId), eq(dishes.isPublished, true), eq(countries.isPublished, true)),
    )
    .limit(1);
  return row;
}

export type PublishedDish = NonNullable<Awaited<ReturnType<typeof findPublishedDish>>>;

/** Ingredients of a dish in content order (amounts for `base_servings`). */
export async function dishIngredientsOf(db: Executor, dishId: string) {
  return db
    .select({
      id: dishIngredients.id,
      key: dishIngredients.key,
      product: dishIngredients.product,
      name: dishIngredients.name,
      amount: dishIngredients.amount,
      unit: dishIngredients.unit,
      aisle: dishIngredients.aisle,
    })
    .from(dishIngredients)
    .where(eq(dishIngredients.dishId, dishId))
    .orderBy(asc(dishIngredients.sort));
}

/** Steps of a dish by number. */
export async function dishStepsOf(db: Executor, dishId: string) {
  return db
    .select({ n: dishSteps.n, text: dishSteps.text, timerSeconds: dishSteps.timerSeconds })
    .from(dishSteps)
    .where(eq(dishSteps.dishId, dishId))
    .orderBy(asc(dishSteps.n));
}

/**
 * Public URL of a content photo: `<media>/content/<image_path>` (nginx serves `content/` photos
 * without a signature; the dev server serves them from the repository in local mode).
 */
export function contentImageUrl(mediaUrl: string, imagePath: string): string {
  return `${mediaUrl}/content/${imagePath}`;
}
