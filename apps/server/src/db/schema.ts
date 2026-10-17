import { sql, type SQL } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import {
  AISLES,
  CONTINENTS,
  CUSTOM_EXCLUSIONS_MAX,
  DEFAULT_REMINDER_TIME,
  DISH_LEVELS,
  DISH_TAGS,
  HOUSEHOLDS,
  INGREDIENT_UNITS,
  SERVINGS_MAX,
  SERVINGS_MIN,
  SUBSCRIPTION_PLANS,
  WEEKDAY_MINUTES,
  type Aisle,
  type Continent,
  type DishLevel,
  type DishTag,
  type Household,
  type IngredientUnit,
  type SubscriptionPlan,
} from '@tma80/shared';

/**
 * Database schema (ТЗ, «Модель данных»): 10 tables, the `user_countries` view and the
 * `has_access` function (both in the SQL migration `0001_access`, Drizzle Kit does not manage
 * functions). Enumerations are `text` with check constraints built from the constants of
 * `packages/shared`, so the client, the server and the database share one list.
 */

/** SQL literal list `'a', 'b'` of known constants (never user input) for check constraints. */
const literals = (values: readonly (string | number)[]) =>
  sql.raw(
    values.map((value) => (typeof value === 'number' ? String(value) : `'${value}'`)).join(', '),
  );

const oneOf = (column: AnyPgColumn, values: readonly (string | number)[]): SQL =>
  sql`${column} in (${literals(values)})`;

/** Every element of a `text[]` column is one of the values. */
const subsetOf = (column: AnyPgColumn, values: readonly string[]): SQL =>
  sql`${column} <@ array[${literals(values)}]::text[]`;

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const subscriptionStatuses = ['active', 'expired', 'refunded'] as const;
export type SubscriptionStatusValue = (typeof subscriptionStatuses)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tgId: bigint('tg_id', { mode: 'number' }).notNull().unique(),
    firstName: text('first_name').notNull(),
    username: text('username'),
    photoUrl: text('photo_url'),
    household: text('household').$type<Household>(),
    weekdayMinutes: smallint('weekday_minutes'),
    exclusions: text('exclusions')
      .array()
      .$type<DishTag[]>()
      .notNull()
      .default(sql`'{}'`),
    /** Cleaned own exclusions (`normalizeCustomExclusions`): ≤ 10 words of 2–40 characters. */
    customExclusions: text('custom_exclusions')
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** IANA time zone; the client sends the real one with `PATCH /me`. */
    timezone: text('timezone').notNull().default('Europe/Moscow'),
    reminderEnabled: boolean('reminder_enabled').notNull().default(false),
    reminderTime: time('reminder_time').notNull().default(`${DEFAULT_REMINDER_TIME}:00`),
    botCanWrite: boolean('bot_can_write').notNull().default(false),
    /** First `/start` in the bot: reminders are switched on by default only then (decision 0020). */
    botStartedAt: timestamp('bot_started_at', { withTimezone: true }),
    inviteCode: text('invite_code').notNull().unique(),
    invitedBy: uuid('invited_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_invited_by_idx').on(table.invitedBy),
    check('users_household_check', oneOf(table.household, HOUSEHOLDS)),
    check('users_weekday_minutes_check', oneOf(table.weekdayMinutes, WEEKDAY_MINUTES)),
    check('users_exclusions_check', subsetOf(table.exclusions, DISH_TAGS)),
    check(
      'users_custom_exclusions_check',
      sql`coalesce(array_length(${table.customExclusions}, 1), 0) <= ${sql.raw(String(CUSTOM_EXCLUSIONS_MAX))}`,
    ),
  ],
);

export const countries = pgTable(
  'countries',
  {
    /** Slug, e.g. `pe`: the folder name in `content/`. */
    id: text('id').primaryKey(),
    nameRu: text('name_ru').notNull(),
    continent: text('continent').$type<Continent>().notNull(),
    sort: integer('sort').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (table) => [check('countries_continent_check', oneOf(table.continent, CONTINENTS))],
);

export const dishes = pgTable(
  'dishes',
  {
    /** `<country>-<slug>`, e.g. `it-carbonara`. */
    id: text('id').primaryKey(),
    countryId: text('country_id')
      .notNull()
      .references(() => countries.id),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    level: text('level').$type<DishLevel>().notNull(),
    minutes: integer('minutes').notNull(),
    baseServings: smallint('base_servings').notNull(),
    description: text('description').notNull(),
    fact: text('fact').notNull(),
    /** Relative to the media root: `<country>/<slug>.webp`. */
    imagePath: text('image_path').notNull(),
    tags: text('tags')
      .array()
      .$type<DishTag[]>()
      .notNull()
      .default(sql`'{}'`),
    isPublished: boolean('is_published').notNull().default(true),
  },
  (table) => [
    unique('dishes_country_slug_unique').on(table.countryId, table.slug),
    // Target of the composite key from `cooks`: a cook's country is its dish's country.
    unique('dishes_id_country_unique').on(table.id, table.countryId),
    check('dishes_level_check', oneOf(table.level, DISH_LEVELS)),
    check('dishes_tags_check', subsetOf(table.tags, DISH_TAGS)),
    check('dishes_minutes_check', sql`${table.minutes} > 0`),
    check(
      'dishes_base_servings_check',
      sql`${table.baseServings} between ${sql.raw(String(SERVINGS_MIN))} and ${sql.raw(String(SERVINGS_MAX))}`,
    ),
  ],
);

export const dishIngredients = pgTable(
  'dish_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dishId: text('dish_id')
      .notNull()
      .references(() => dishes.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    product: text('product').notNull(),
    name: text('name').notNull(),
    /** For `dishes.base_servings`; `null` together with `unit` — «по вкусу». */
    amount: numeric('amount', { mode: 'number' }),
    unit: text('unit').$type<IngredientUnit>(),
    aisle: text('aisle').$type<Aisle>().notNull(),
    sort: integer('sort').notNull(),
  },
  (table) => [
    unique('dish_ingredients_dish_key_unique').on(table.dishId, table.key),
    // Target of the composite key from `shopping_items`.
    unique('dish_ingredients_id_dish_unique').on(table.id, table.dishId),
    check('dish_ingredients_unit_check', oneOf(table.unit, INGREDIENT_UNITS)),
    check('dish_ingredients_aisle_check', oneOf(table.aisle, AISLES)),
    check(
      'dish_ingredients_amount_check',
      sql`(${table.amount} is null) = (${table.unit} is null) and (${table.amount} is null or ${table.amount} > 0)`,
    ),
  ],
);

export const dishSteps = pgTable(
  'dish_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dishId: text('dish_id')
      .notNull()
      .references(() => dishes.id, { onDelete: 'cascade' }),
    /** Step number, from 1. */
    n: smallint('n').notNull(),
    /** With `{key}` placeholders of this dish's ingredients. */
    text: text('text').notNull(),
    timerSeconds: integer('timer_seconds'),
  },
  (table) => [
    unique('dish_steps_dish_n_unique').on(table.dishId, table.n),
    check('dish_steps_n_check', sql`${table.n} > 0`),
    check(
      'dish_steps_timer_check',
      sql`${table.timerSeconds} is null or ${table.timerSeconds} > 0`,
    ),
  ],
);

export const cooks = pgTable(
  'cooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dishId: text('dish_id').notNull(),
    countryId: text('country_id').notNull(),
    /** `{user_id}/{uuid}.jpg` in the private `cooks` folder; the photo is optional. */
    photoPath: text('photo_path'),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'cooks_dish_country_fk',
      columns: [table.dishId, table.countryId],
      foreignColumns: [dishes.id, dishes.countryId],
    }),
    // FK lookups when a dish changes; `dishes.country_id` is covered by `dishes_country_slug_unique`.
    index('cooks_dish_country_idx').on(table.dishId, table.countryId),
    index('cooks_user_created_idx').on(table.userId, table.createdAt),
    index('cooks_user_country_idx').on(table.userId, table.countryId),
  ],
);

export const friendships = pgTable(
  'friendships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    friendId: uuid('friend_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.friendId] }),
    index('friendships_friend_idx').on(table.friendId),
    check('friendships_not_self_check', sql`${table.userId} <> ${table.friendId}`),
  ],
);

export const shoppingItems = pgTable(
  'shopping_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id').notNull(),
    dishId: text('dish_id').notNull(),
    servings: smallint('servings').notNull(),
    checked: boolean('checked').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: 'shopping_items_ingredient_dish_fk',
      columns: [table.ingredientId, table.dishId],
      foreignColumns: [dishIngredients.id, dishIngredients.dishId],
    }).onDelete('cascade'),
    index('shopping_items_user_idx').on(table.userId),
    index('shopping_items_ingredient_dish_idx').on(table.ingredientId, table.dishId),
    check(
      'shopping_items_servings_check',
      sql`${table.servings} between ${sql.raw(String(SERVINGS_MIN))} and ${sql.raw(String(SERVINGS_MAX))}`,
    ),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plan: text('plan').$type<SubscriptionPlan>().notNull(),
    starsAmount: integer('stars_amount').notNull(),
    /** Idempotency key of the `successful_payment` webhook; needed for refunds. */
    telegramPaymentChargeId: text('telegram_payment_charge_id').notNull().unique(),
    isRecurring: boolean('is_recurring').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: text('status').$type<SubscriptionStatusValue>().notNull().default('active'),
    createdAt: createdAt(),
  },
  (table) => [
    index('subscriptions_user_expires_idx').on(table.userId, table.expiresAt),
    check('subscriptions_plan_check', oneOf(table.plan, SUBSCRIPTION_PLANS)),
    check('subscriptions_status_check', oneOf(table.status, subscriptionStatuses)),
    check('subscriptions_stars_check', sql`${table.starsAmount} > 0`),
    check('subscriptions_period_check', sql`${table.expiresAt} > ${table.startsAt}`),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [index('events_name_created_idx').on(table.name, table.createdAt)],
);

/**
 * Passed countries of a user with the date of the first stamp (a country is passed once the user
 * has a cook of its dish). Defined in the SQL migration `0001_access`; `.existing()` keeps
 * Drizzle Kit from generating it.
 */
export const userCountries = pgView('user_countries', {
  userId: uuid('user_id').notNull(),
  countryId: text('country_id').notNull(),
  firstStampAt: timestamp('first_stamp_at', { withTimezone: true }).notNull(),
}).existing();
