import { and, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';

import { WEEKDAY_MINUTES, type SubscriptionStatus, type UserProfile } from '@tma80/shared';

import type { InitData } from '../auth/initData.ts';
import { generateInviteCode } from '../auth/inviteCode.ts';
import type { Db } from './client.ts';
import { events, friendships, subscriptions, users } from './schema.ts';

export type UserRow = typeof users.$inferSelect;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export async function findUserByTgId(db: Executor, tgId: number): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.tgId, tgId)).limit(1);
  return row;
}

const isWeekdayMinutes = (value: number): value is (typeof WEEKDAY_MINUTES)[number] =>
  (WEEKDAY_MINUTES as readonly number[]).includes(value);

/** `users` row → profile of the API (`userProfileSchema`). */
export function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    tgId: row.tgId,
    firstName: row.firstName,
    username: row.username,
    photoUrl: row.photoUrl,
    household: row.household,
    weekdayMinutes:
      row.weekdayMinutes !== null && isWeekdayMinutes(row.weekdayMinutes)
        ? row.weekdayMinutes
        : null,
    exclusions: row.exclusions,
    customExclusions: row.customExclusions,
    timezone: row.timezone,
    reminderEnabled: row.reminderEnabled,
    // Postgres `time` comes as `HH:MM:SS`.
    reminderTime: row.reminderTime.slice(0, 5),
    botCanWrite: row.botCanWrite,
    inviteCode: row.inviteCode,
  };
}

/**
 * Subscription status (ТЗ, «Модель данных»): active while a non-refunded `active` record has
 * `expires_at` in the future; `plan` and `expiresAt` describe the period that ends last.
 * Refunded records are ignored.
 */
export async function subscriptionStatus(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<SubscriptionStatus> {
  const [latest] = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), ne(subscriptions.status, 'refunded')))
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);
  if (!latest) return { active: false, plan: null, expiresAt: null };
  return {
    active: latest.status === 'active' && latest.expiresAt > now,
    plan: latest.plan,
    expiresAt: latest.expiresAt.toISOString(),
  };
}

/**
 * Creates the user or refreshes the Telegram fields (name, username, photo, last visit).
 * `bot_can_write` is only raised by `allows_write_to_pm`, never reset here.
 */
async function upsertUser(
  tx: Tx,
  user: InitData['user'],
  now: Date,
): Promise<{ row: UserRow; isNew: boolean }> {
  const [result] = await tx
    .insert(users)
    .values({
      tgId: user.tgId,
      firstName: user.firstName,
      username: user.username,
      photoUrl: user.photoUrl,
      botCanWrite: user.allowsWriteToPm,
      inviteCode: generateInviteCode(),
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: users.tgId,
      set: {
        firstName: sql`excluded.first_name`,
        username: sql`excluded.username`,
        photoUrl: sql`excluded.photo_url`,
        botCanWrite: sql`${users.botCanWrite} or excluded.bot_can_write`,
        lastSeenAt: sql`excluded.last_seen_at`,
      },
    })
    // `xmax = 0` only for a freshly inserted row (an updated one carries the updating xid).
    .returning({ ...getTableColumns(users), isNew: sql<boolean>`(xmax = 0)` });
  if (!result) throw new Error('user upsert returned no row');
  const { isNew, ...row } = result;
  return { row, isNew };
}

/**
 * Invitation by `start_param` (ТЗ, «Запуск и приглашения»): friendship both ways unless it exists
 * or the code is the user's own; `invited_by` and the `invite_joined` event only for a new user.
 * An unknown code is ignored.
 */
async function applyInvite(
  tx: Tx,
  user: UserRow,
  isNew: boolean,
  code: string,
  now: Date,
): Promise<UserRow> {
  const [inviter] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.inviteCode, code), ne(users.id, user.id)))
    .limit(1);
  if (!inviter) return user;

  await tx
    .insert(friendships)
    .values([
      { userId: user.id, friendId: inviter.id, createdAt: now },
      { userId: inviter.id, friendId: user.id, createdAt: now },
    ])
    .onConflictDoNothing();
  if (!isNew) return user;

  const [updated] = await tx
    .update(users)
    .set({ invitedBy: inviter.id })
    .where(eq(users.id, user.id))
    .returning();
  await tx.insert(events).values({
    userId: user.id,
    name: 'invite_joined',
    props: { inviter_id: inviter.id },
    createdAt: now,
  });
  return updated ?? user;
}

const UNIQUE_VIOLATION = '23505';

/** Postgres error behind a Drizzle query error (`DrizzleQueryError.cause`). */
const isInviteCodeCollision = (error: unknown): boolean => {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (
      'code' in current &&
      current.code === UNIQUE_VIOLATION &&
      'constraint' in current &&
      current.constraint === 'users_invite_code_unique'
    ) {
      return true;
    }
  }
  return false;
};

/** `POST /auth` in one transaction: upsert the user, then the invitation. */
export async function signIn(
  db: Db,
  initData: InitData,
  now = new Date(),
): Promise<{ user: UserRow; isNew: boolean }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const { row, isNew } = await upsertUser(tx, initData.user, now);
        const user =
          initData.startParam === null
            ? row
            : await applyInvite(tx, row, isNew, initData.startParam, now);
        return { user, isNew };
      });
    } catch (error) {
      // A new random invite code clashed with an existing one: retry with another.
      if (attempt < 3 && isInviteCodeCollision(error)) continue;
      throw error;
    }
  }
}
