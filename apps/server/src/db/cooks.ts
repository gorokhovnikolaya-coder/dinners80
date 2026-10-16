import { and, asc, count, countDistinct, eq, gt, inArray, sql } from 'drizzle-orm';

import {
  COOKS_PER_DAY_LIMIT,
  findOvertakenFriend,
  type Cook,
  type CreateCookResponse,
} from '@tma80/shared';

import type { Db } from './client.ts';
import type { PublishedDish } from './content.ts';
import { cooks, countries, friendships, users } from './schema.ts';
import type { Executor } from './users.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** All cooks of the users, oldest first (as the shared algorithms take them). */
export async function cooksOf(db: Executor, userIds: readonly string[]): Promise<Cook[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({
      id: cooks.id,
      userId: cooks.userId,
      dishId: cooks.dishId,
      countryId: cooks.countryId,
      photoPath: cooks.photoPath,
      createdAt: cooks.createdAt,
    })
    .from(cooks)
    .where(inArray(cooks.userId, [...userIds]))
    .orderBy(asc(cooks.createdAt), asc(cooks.id));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** `has_access(user, country)` of the database (migration `0001_access`). */
export async function hasAccess(db: Executor, userId: string, countryId: string): Promise<boolean> {
  const result = await db.execute<{ allowed: boolean }>(
    sql`select has_access(${userId}::uuid, ${countryId}) as allowed`,
  );
  return result.rows[0]?.allowed === true;
}

/** Friends of the user (both directions are stored, so one side is enough). */
export async function friendsOf(db: Executor, userId: string) {
  return db
    .select({ id: users.id, firstName: users.firstName, photoUrl: users.photoUrl })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .where(eq(friendships.userId, userId))
    .orderBy(asc(users.id));
}

/** Passed published countries and all cooks of each user. */
async function countersOf(db: Executor, userIds: readonly string[]) {
  const counters = new Map<string, { countries: number; dishes: number }>();
  if (userIds.length === 0) return counters;
  const dishRows = await db
    .select({ userId: cooks.userId, dishes: count() })
    .from(cooks)
    .where(inArray(cooks.userId, [...userIds]))
    .groupBy(cooks.userId);
  const countryRows = await db
    .select({ userId: cooks.userId, countries: countDistinct(cooks.countryId) })
    .from(cooks)
    .innerJoin(countries, eq(countries.id, cooks.countryId))
    .where(and(inArray(cooks.userId, [...userIds]), eq(countries.isPublished, true)))
    .groupBy(cooks.userId);
  for (const id of userIds) counters.set(id, { countries: 0, dishes: 0 });
  for (const row of dishRows) counters.set(row.userId, { countries: 0, dishes: row.dishes });
  for (const row of countryRows) {
    const known = counters.get(row.userId);
    if (known) known.countries = row.countries;
  }
  return counters;
}

/** Number of published countries (the «из 30»). */
export async function publishedCountriesCount(db: Executor): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(countries)
    .where(eq(countries.isPublished, true));
  return row?.total ?? 0;
}

export type RecordCookResult =
  { kind: 'ok'; result: CreateCookResponse } | { kind: 'paywall' } | { kind: 'rateLimited' };

/**
 * `POST /cooks` in one transaction, serialised per user by an advisory lock so parallel requests
 * cannot pass the daily limit: at most `COOKS_PER_DAY_LIMIT` cooks in 24 hours, access by
 * `has_access`, then the cook, the counters after it and the friend overtaken (ТЗ, «Обогнал друга»).
 * @param photoPath - `{user_id}/{uuid}.jpg` in the private `cooks` folder, or `null`.
 */
export async function recordCook(
  db: Db,
  userId: string,
  dish: Pick<PublishedDish, 'id' | 'countryId'>,
  photoPath: string | null,
  now: Date,
): Promise<RecordCookResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`cooks:${userId}`}))`);
    const [recent] = await tx
      .select({ total: count() })
      .from(cooks)
      .where(and(eq(cooks.userId, userId), gt(cooks.createdAt, new Date(now.getTime() - DAY_MS))));
    if ((recent?.total ?? 0) >= COOKS_PER_DAY_LIMIT) return { kind: 'rateLimited' };
    if (!(await hasAccess(tx, userId, dish.countryId))) return { kind: 'paywall' };

    const before = (await countersOf(tx, [userId])).get(userId) ?? { countries: 0, dishes: 0 };
    const [cook] = await tx
      .insert(cooks)
      .values({ userId, dishId: dish.id, countryId: dish.countryId, photoPath, createdAt: now })
      .returning({ id: cooks.id });
    if (!cook) throw new Error('cook insert returned no row');
    const after = (await countersOf(tx, [userId])).get(userId) ?? before;

    const friends = await friendsOf(tx, userId);
    const friendCounters = await countersOf(
      tx,
      friends.map((friend) => friend.id),
    );
    const overtook = findOvertakenFriend(
      before.countries,
      after.countries,
      friends.map((friend) => ({
        name: friend.firstName,
        ...(friendCounters.get(friend.id) ?? { countries: 0, dishes: 0 }),
      })),
    );
    return {
      kind: 'ok',
      result: {
        cookId: cook.id,
        newCountry: after.countries > before.countries,
        countriesCount: after.countries,
        countriesTotal: await publishedCountriesCount(tx),
        dishesCount: after.dishes,
        overtook,
      },
    };
  });
}
