/** Who eats the dinner (onboarding step 1, `users.household`). */
export const HOUSEHOLDS = ['solo', 'couple', 'family'] as const;
export type Household = (typeof HOUSEHOLDS)[number];

/** Weekday dinner time in minutes (onboarding step 2, `users.weekday_minutes`). */
export const WEEKDAY_MINUTES = [20, 30, 45] as const;
export type WeekdayMinutes = (typeof WEEKDAY_MINUTES)[number];

/**
 * Dish tags that a user can exclude (onboarding step 3, `users.exclusions`, `dishes.tags`):
 * meat (pork included — a pork dish is just `meat`), spicy, gluten.
 */
export const DISH_TAGS = ['meat', 'spicy', 'gluten'] as const;
export type DishTag = (typeof DISH_TAGS)[number];

/**
 * Limits of the user's own exclusions (onboarding step 3 «Своё», `users.custom_exclusions`):
 * at most 10 words, each 2–40 characters after trimming, with at least one letter.
 */
export const CUSTOM_EXCLUSIONS_MAX = 10;
export const CUSTOM_EXCLUSION_MIN_LENGTH = 2;
export const CUSTOM_EXCLUSION_MAX_LENGTH = 40;
/** Cap of the raw value before cleaning (a string of spaces must not pass). */
export const CUSTOM_EXCLUSION_RAW_MAX_LENGTH = 100;

/** Dish levels: weekday evening, weekend, challenge (`dishes.level`). */
export const DISH_LEVELS = ['weekday', 'weekend', 'challenge'] as const;
export type DishLevel = (typeof DISH_LEVELS)[number];

/** Subscription plans paid in Telegram Stars (`subscriptions.plan`). */
export const SUBSCRIPTION_PLANS = ['month', 'year'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** A free user may collect this many countries; the next new country needs a subscription. */
export const FREE_COUNTRIES_LIMIT = 10;

/** Default dinner reminder time (`users.reminder_time`). */
export const DEFAULT_REMINDER_TIME = '18:00';

/** Servings on the dish card: − / + from 1 to 8 (ТЗ, экран 2). */
export const SERVINGS_MIN = 1;
export const SERVINGS_MAX = 8;

/**
 * Units of ingredient amounts (`dish_ingredients.unit`): grams, millilitres, pieces, table- and
 * teaspoons, garlic cloves, pinches. An ingredient «to taste» has neither amount nor unit.
 */
export const INGREDIENT_UNITS = ['g', 'ml', 'pcs', 'tbsp', 'tsp', 'clove', 'pinch'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/** Store aisles of the shopping list (`dish_ingredients.aisle`). */
export const AISLES = ['meat', 'veg', 'dairy', 'grocery', 'other'] as const;
export type Aisle = (typeof AISLES)[number];
