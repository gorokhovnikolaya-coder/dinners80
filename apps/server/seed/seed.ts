import { and, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod/mini';
import { en } from 'zod/locales';

import { connect, type Db } from '../src/db/client.ts';
import { countries, dishes, dishIngredients, dishSteps } from '../src/db/schema.ts';
import { ContentError, loadContent, missingPhotos, type Content } from './content.ts';

/** `excluded.<column>` of an upsert. */
const excluded = (column: string): SQL => sql.raw(`excluded."${column}"`);

export interface SeedResult {
  countries: number;
  dishes: number;
  ingredients: number;
  steps: number;
}

/**
 * Loads validated content into the database in one transaction. Countries and dishes are upserted
 * by id; ones that left the content are unpublished, not deleted (cooks refer to them).
 * Ingredients are upserted by (dish, key), so shopping list items keep their ingredient; removed
 * ingredients are deleted with their shopping items. Steps are replaced. Safe to run again.
 */
export async function seedContent(db: Db, content: Content): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    const countryIds = content.countries.map((country) => country.id);
    const dishIds = content.dishes.map((dish) => dish.id);

    await tx
      .insert(countries)
      .values(content.countries.map((country) => ({ ...country, isPublished: true })))
      .onConflictDoUpdate({
        target: countries.id,
        set: {
          nameRu: excluded('name_ru'),
          continent: excluded('continent'),
          sort: excluded('sort'),
          isPublished: true,
        },
      });
    await tx
      .update(countries)
      .set({ isPublished: false })
      .where(notInArray(countries.id, countryIds));

    await tx
      .insert(dishes)
      .values(
        content.dishes.map((dish) => ({
          id: dish.id,
          countryId: dish.countryId,
          slug: dish.slug,
          title: dish.title,
          level: dish.level,
          minutes: dish.minutes,
          baseServings: dish.baseServings,
          description: dish.description,
          fact: dish.fact,
          imagePath: dish.imagePath,
          tags: dish.tags,
          isPublished: true,
        })),
      )
      .onConflictDoUpdate({
        target: dishes.id,
        set: {
          countryId: excluded('country_id'),
          slug: excluded('slug'),
          title: excluded('title'),
          level: excluded('level'),
          minutes: excluded('minutes'),
          baseServings: excluded('base_servings'),
          description: excluded('description'),
          fact: excluded('fact'),
          imagePath: excluded('image_path'),
          tags: excluded('tags'),
          isPublished: true,
        },
      });
    await tx.update(dishes).set({ isPublished: false }).where(notInArray(dishes.id, dishIds));

    const ingredients = content.dishes.flatMap((dish) =>
      dish.ingredients.map((item) => ({ ...item, dishId: dish.id })),
    );
    await tx
      .insert(dishIngredients)
      .values(ingredients)
      .onConflictDoUpdate({
        target: [dishIngredients.dishId, dishIngredients.key],
        set: {
          product: excluded('product'),
          name: excluded('name'),
          amount: excluded('amount'),
          unit: excluded('unit'),
          aisle: excluded('aisle'),
          sort: excluded('sort'),
        },
      });
    for (const dish of content.dishes) {
      const keys = dish.ingredients.map((item) => item.key);
      await tx
        .delete(dishIngredients)
        .where(and(eq(dishIngredients.dishId, dish.id), notInArray(dishIngredients.key, keys)));
    }

    await tx.delete(dishSteps).where(inArray(dishSteps.dishId, dishIds));
    const steps = content.dishes.flatMap((dish) =>
      dish.steps.map((step) => ({ ...step, dishId: dish.id })),
    );
    await tx.insert(dishSteps).values(steps);

    return {
      countries: content.countries.length,
      dishes: content.dishes.length,
      ingredients: ingredients.length,
      steps: steps.length,
    };
  });
}

export interface SeedOptions {
  /**
   * Fail instead of warning when dish photos are missing: production seeds with
   * `--require-photos` so dishes never go live without a picture (decision 0025).
   */
  requirePhotos?: boolean;
}

/**
 * The missing-photo check of the seed: `null` when every photo is in place, otherwise the message.
 * With `requirePhotos` the seed throws it as a `ContentError`, without — prints it as a warning.
 */
export function missingPhotosMessage(missing: readonly string[], total: number): string | null {
  if (missing.length === 0) return null;
  const examples = missing.slice(0, 3).join(', ');
  return `${String(missing.length)} of ${String(total)} dish photos are missing in content/ (${examples}${missing.length > 3 ? ', …' : ''})`;
}

/** Validates `content/`, checks dish photos and seeds the database. */
export async function runSeed(db: Db, options: SeedOptions = {}): Promise<SeedResult> {
  const content = await loadContent();
  const message = missingPhotosMessage(missingPhotos(content.dishes), content.dishes.length);
  if (message !== null) {
    if (options.requirePhotos === true) throw new ContentError([message]);
    console.warn(`Warning: ${message}`);
  }
  const result = await seedContent(db, content);
  console.log(
    `Seeded ${String(result.countries)} countries, ${String(result.dishes)} dishes, ${String(result.ingredients)} ingredients, ${String(result.steps)} steps`,
  );
  return result;
}

/** Readable zod messages for content errors (zod/mini has no locale by default). */
export function useEnglishErrors(): void {
  z.config(en());
}

/** Runs `main` and exits with code 1 and a readable message on a content error. */
export async function runCli(main: () => Promise<void>): Promise<void> {
  useEnglishErrors();
  try {
    await main();
  } catch (error) {
    if (error instanceof ContentError) console.error(error.message);
    else console.error(error);
    process.exitCode = 1;
  }
}

// `npm run db:seed [-- --require-photos]`
if (import.meta.main) {
  await runCli(async () => {
    const requirePhotos = process.argv.slice(2).includes('--require-photos');
    const { db, pool } = connect();
    try {
      await runSeed(db, { requirePhotos });
    } finally {
      await pool.end();
    }
  });
}
