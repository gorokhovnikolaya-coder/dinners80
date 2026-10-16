import { z } from 'zod/mini';

import {
  AISLES,
  CONTINENTS,
  DISH_LEVELS,
  DISH_TAGS,
  INGREDIENT_UNITS,
  SERVINGS_MAX,
  SERVINGS_MIN,
  type Aisle,
  type Continent,
  type DishLevel,
  type DishTag,
  type IngredientUnit,
} from './constants.ts';
import { findStepPlaceholderProblems } from './steps.ts';

/**
 * Content files of the repository (`content/`), loaded into the database by the seed (task 14):
 * `content/<country>/country.json` — a country, `content/<country>/<slug>.json` — a dish with its
 * ingredients and steps for `baseServings`. The folder name is the country id, the file name is
 * the dish slug; the dish id is `<country>-<slug>`, its photo is `<country>/<slug>.webp`.
 */

const slugKey = z.string().check(z.regex(/^[a-z0-9_]+$/));

/** Folder name of a country: its id (`countries.id`). */
export const CONTENT_COUNTRY_ID = /^[a-z]{2,3}$/;
/** File name of a dish without `.json`: its slug (`dishes.slug`). */
export const CONTENT_DISH_SLUG = /^[a-z0-9-]+$/;
/** File of a country inside its folder. */
export const CONTENT_COUNTRY_FILE = 'country.json';

/** `content/<country>/country.json`. */
export const contentCountryFileSchema = z.strictObject({
  nameRu: z.string().check(z.minLength(1)),
  continent: z.enum(CONTINENTS),
  /** Order of the country on the map and in the paywall. */
  sort: z.int().check(z.positive()),
});
export type ContentCountryFile = z.infer<typeof contentCountryFileSchema>;

/** An ingredient of a dish file, the amount is for the dish's `baseServings`. */
export const contentIngredientSchema = z
  .strictObject({
    /** Unique within the dish; steps refer to it as `{key}`. */
    key: slugKey,
    /** Common product key for summing the shopping list; defaults to `key`. */
    product: z.optional(slugKey),
    name: z.string().check(z.minLength(1)),
    /** `null` together with `unit` — «по вкусу» (to taste). */
    amount: z.nullable(z.number().check(z.positive())),
    unit: z.nullable(z.enum(INGREDIENT_UNITS)),
    aisle: z.enum(AISLES),
  })
  .check(
    z.refine(
      (item) => (item.amount === null) === (item.unit === null),
      'amount and unit are both set or both null («по вкусу»)',
    ),
  );
export type ContentIngredient = z.infer<typeof contentIngredientSchema>;

/** A step of a dish file: text with `{key}` placeholders, optional timer in whole minutes. */
export const contentStepSchema = z.strictObject({
  text: z.string().check(z.minLength(1)),
  timerMinutes: z.optional(z.int().check(z.positive())),
});

/** `content/<country>/<slug>.json`. */
export const contentDishFileSchema = z.strictObject({
  title: z.string().check(z.minLength(1)),
  level: z.enum(DISH_LEVELS),
  minutes: z.int().check(z.positive()),
  baseServings: z.int().check(z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX)),
  /** meat (pork included), spicy, gluten. */
  tags: z.array(z.enum(DISH_TAGS)),
  description: z.string().check(z.minLength(1)),
  fact: z.string().check(z.minLength(1)),
  ingredients: z.array(contentIngredientSchema).check(z.minLength(1)),
  steps: z.array(contentStepSchema).check(z.minLength(1)),
});
export type ContentDishFile = z.infer<typeof contentDishFileSchema>;

/** A raw content file read from disk: parsed JSON, not validated yet. */
export interface RawContentFile {
  /** Path for error messages, e.g. `content/it/carbonara.json`. */
  path: string;
  data: unknown;
}

export interface RawContent {
  /** `country.json` of each country folder; `id` is the folder name. */
  countries: readonly (RawContentFile & { id: string })[];
  dishes: readonly (RawContentFile & { countryId: string; slug: string })[];
}

/** A country ready for the `countries` table. */
export interface SeedCountry {
  id: string;
  nameRu: string;
  continent: Continent;
  sort: number;
}

export interface SeedIngredient {
  key: string;
  product: string;
  name: string;
  amount: number | null;
  unit: IngredientUnit | null;
  aisle: Aisle;
  /** Position in the dish, from 0. */
  sort: number;
}

export interface SeedStep {
  /** Step number, from 1. */
  n: number;
  text: string;
  timerSeconds: number | null;
}

/** A dish ready for `dishes`, `dish_ingredients` and `dish_steps`. */
export interface SeedDish {
  id: string;
  countryId: string;
  slug: string;
  title: string;
  level: DishLevel;
  minutes: number;
  baseServings: number;
  description: string;
  fact: string;
  imagePath: string;
  tags: DishTag[];
  ingredients: SeedIngredient[];
  steps: SeedStep[];
}

export type ContentValidation =
  { ok: true; countries: SeedCountry[]; dishes: SeedDish[] } | { ok: false; errors: string[] };

const issuesOf = (path: string, error: z.core.$ZodError) =>
  error.issues.map((issue) => {
    const at = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    return `${path}${at}: ${issue.message}`;
  });

/** Dish photo path relative to the media root: `<country>/<slug>.webp`. */
export const contentImagePath = (countryId: string, slug: string) => `${countryId}/${slug}.webp`;

/**
 * Validates every content file and the rules across them; collects all errors instead of
 * stopping at the first one. Rules: file schemas; unique ingredient keys in a dish; no step
 * placeholder with an unknown key or with an ingredient «по вкусу»; one aisle per `product`
 * across all dishes; a dish folder has `country.json`; unique country `sort`.
 */
export function validateContent(raw: RawContent): ContentValidation {
  const errors: string[] = [];
  const countries: SeedCountry[] = [];
  const sorts = new Map<number, string>();

  for (const file of raw.countries) {
    if (!CONTENT_COUNTRY_ID.test(file.id)) {
      errors.push(`${file.path}: country folder must match ${String(CONTENT_COUNTRY_ID)}`);
      continue;
    }
    const parsed = contentCountryFileSchema.safeParse(file.data);
    if (!parsed.success) {
      errors.push(...issuesOf(file.path, parsed.error));
      continue;
    }
    const other = sorts.get(parsed.data.sort);
    if (other !== undefined) {
      errors.push(`${file.path}: sort ${String(parsed.data.sort)} is already used by ${other}`);
    }
    sorts.set(parsed.data.sort, file.path);
    countries.push({ id: file.id, ...parsed.data });
  }

  const countryIds = new Set(raw.countries.map((file) => file.id));
  const dishes: SeedDish[] = [];
  /** product → first aisle seen and where. */
  const aisles = new Map<string, { aisle: Aisle; path: string }>();

  for (const file of raw.dishes) {
    const fileErrors: string[] = [];
    if (!countryIds.has(file.countryId)) {
      fileErrors.push(`${file.path}: folder ${file.countryId} has no ${CONTENT_COUNTRY_FILE}`);
    }
    if (!CONTENT_DISH_SLUG.test(file.slug)) {
      fileErrors.push(`${file.path}: file name must match ${String(CONTENT_DISH_SLUG)}`);
    }
    const parsed = contentDishFileSchema.safeParse(file.data);
    if (!parsed.success) {
      errors.push(...fileErrors, ...issuesOf(file.path, parsed.error));
      continue;
    }
    const dish = parsed.data;

    const keys = new Set<string>();
    for (const item of dish.ingredients) {
      if (keys.has(item.key))
        fileErrors.push(`${file.path}: duplicate ingredient key «${item.key}»`);
      keys.add(item.key);
    }

    for (const problem of findStepPlaceholderProblems(dish.ingredients, dish.steps)) {
      const why =
        problem.reason === 'unknownKey'
          ? 'no ingredient with this key'
          : 'the ingredient is «по вкусу» (no amount)';
      fileErrors.push(`${file.path}: step ${String(problem.step)} has {${problem.key}}: ${why}`);
    }

    for (const item of dish.ingredients) {
      const product = item.product ?? item.key;
      const seen = aisles.get(product);
      if (seen === undefined) aisles.set(product, { aisle: item.aisle, path: file.path });
      else if (seen.aisle !== item.aisle) {
        fileErrors.push(
          `${file.path}: product «${product}» is in aisle ${item.aisle}, but in ${seen.path} it is in ${seen.aisle}`,
        );
      }
    }

    if (fileErrors.length > 0) {
      errors.push(...fileErrors);
      continue;
    }
    dishes.push({
      id: `${file.countryId}-${file.slug}`,
      countryId: file.countryId,
      slug: file.slug,
      title: dish.title,
      level: dish.level,
      minutes: dish.minutes,
      baseServings: dish.baseServings,
      description: dish.description,
      fact: dish.fact,
      imagePath: contentImagePath(file.countryId, file.slug),
      tags: [...new Set(dish.tags)],
      ingredients: dish.ingredients.map((item, sort) => ({
        key: item.key,
        product: item.product ?? item.key,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        aisle: item.aisle,
        sort,
      })),
      steps: dish.steps.map((step, index) => ({
        n: index + 1,
        text: step.text,
        timerSeconds: step.timerMinutes === undefined ? null : step.timerMinutes * 60,
      })),
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, countries, dishes };
}
