import { and, eq, inArray } from 'drizzle-orm';

import { SUBSCRIPTION_PERIOD_DAYS, SUBSCRIPTION_PRICES_STARS } from '@tma80/shared';

// Dev-only: the test users of the mock mode (decision 0003) loaded into the local database, so
// `VITE_API=local` with `?user=<id>` shows the same states as the mock. The fixtures carry only
// plain data and `@tma80/shared` types.
import { cooks as fixtureCooks } from '../../web/src/mocks/fixtures/cooks.ts';
import { shoppingFixtures } from '../../web/src/mocks/fixtures/shopping.ts';
import { friendships as fixtureFriendships, users } from '../../web/src/mocks/fixtures/users.ts';
import { connect, databaseUrl, type Db } from '../src/db/client.ts';
import {
  cooks,
  dishIngredients,
  friendships,
  shoppingItems,
  subscriptions,
  users as usersTable,
} from '../src/db/schema.ts';
import { nonLocalDatabaseReason } from './localDatabase.ts';
import { runCli } from './seed.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows of the test users as the database stores them (dates relative to `now`, as in the mock). */
export function devUserRows(now: Date) {
  const idOf = new Map(users.map((user) => [user.tg.id, user.profile.id]));
  const userId = (tgId: number) => {
    const id = idOf.get(tgId);
    if (id === undefined) throw new Error(`Fixture user ${String(tgId)} not found`);
    return id;
  };
  return {
    users: users.map(({ profile, onboarded }) => ({
      id: profile.id,
      tgId: profile.tgId,
      firstName: profile.firstName,
      username: profile.username,
      photoUrl: profile.photoUrl,
      household: profile.household,
      weekdayMinutes: profile.weekdayMinutes,
      exclusions: profile.exclusions,
      customExclusions: profile.customExclusions,
      timezone: profile.timezone,
      reminderEnabled: profile.reminderEnabled,
      reminderTime: profile.reminderTime,
      botCanWrite: profile.botCanWrite,
      inviteCode: profile.inviteCode,
      onboardedAt: onboarded ? now : null,
      createdAt: now,
      lastSeenAt: now,
    })),
    subscriptions: users.flatMap(({ tg, profile, subscription }) => {
      if (subscription.plan === null || subscription.expiresAt === null) return [];
      const expiresAt = new Date(subscription.expiresAt);
      return [
        {
          userId: profile.id,
          plan: subscription.plan,
          starsAmount: SUBSCRIPTION_PRICES_STARS[subscription.plan],
          telegramPaymentChargeId: `dev-fixture-${String(tg.id)}`,
          isRecurring: false,
          startsAt: new Date(
            expiresAt.getTime() - SUBSCRIPTION_PERIOD_DAYS[subscription.plan] * DAY_MS,
          ),
          expiresAt,
          status: subscription.active ? ('active' as const) : ('expired' as const),
        },
      ];
    }),
    // `cooks.photo_path` is stored without the `cooks/` folder of the API path.
    cooks: fixtureCooks.map((cook) => ({
      userId: cook.userId,
      dishId: cook.dishId,
      countryId: cook.countryId,
      photoPath: cook.photoPath?.replace(/^cooks\//, '') ?? null,
      createdAt: new Date(cook.createdAt),
    })),
    friendships: fixtureFriendships.flatMap(([a, b]) => [
      { userId: userId(a), friendId: userId(b), createdAt: now },
      { userId: userId(b), friendId: userId(a), createdAt: now },
    ]),
    shopping: Object.entries(shoppingFixtures).flatMap(([tgId, items]) =>
      items.map((item) => ({
        userId: userId(Number(tgId)),
        dishId: item.dishId,
        ingredientKey: item.ingredientKey,
        servings: item.servings,
        checked: item.checked,
        createdAt: new Date(item.createdAt),
      })),
    ),
  };
}

/**
 * Replaces the test users (and everything of theirs, by cascade) with the fixtures in one
 * transaction. The content must be seeded first: cooks and shopping items refer to its dishes.
 */
export async function seedDevUsers(db: Db, now = new Date()): Promise<number> {
  const rows = devUserRows(now);
  await db.transaction(async (tx) => {
    await tx.delete(usersTable).where(
      inArray(
        usersTable.tgId,
        rows.users.map((user) => user.tgId),
      ),
    );
    await tx.insert(usersTable).values(rows.users);
    await tx.insert(subscriptions).values(rows.subscriptions);
    await tx.insert(cooks).values(rows.cooks);
    await tx.insert(friendships).values(rows.friendships);
    for (const item of rows.shopping) {
      const [ingredient] = await tx
        .select({ id: dishIngredients.id })
        .from(dishIngredients)
        .where(
          and(eq(dishIngredients.dishId, item.dishId), eq(dishIngredients.key, item.ingredientKey)),
        );
      if (!ingredient)
        throw new Error(`No ingredient ${item.ingredientKey} of ${item.dishId}: run db:seed first`);
      await tx.insert(shoppingItems).values({
        userId: item.userId,
        ingredientId: ingredient.id,
        dishId: item.dishId,
        servings: item.servings,
        checked: item.checked,
        createdAt: item.createdAt,
      });
    }
  });
  return rows.users.length;
}

// `npm run db:seed:dev`
if (import.meta.main) {
  await runCli(async () => {
    const url = databaseUrl();
    const reason = nonLocalDatabaseReason(url);
    if (reason !== null) throw new Error(`db:seed:dev only works on a local database: ${reason}`);
    const { db, pool } = connect(url);
    try {
      const count = await seedDevUsers(db);
      console.log(`Test users of the mock mode loaded: ${String(count)}`);
    } finally {
      await pool.end();
    }
  });
}
