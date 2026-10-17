import { and, eq, gt, max } from 'drizzle-orm';
import type { SuccessfulPayment } from 'grammy/types';

import {
  parseInvoicePayload,
  paymentPeriod,
  planByStars,
  STARS_CURRENCY,
  SUBSCRIPTION_PRICES_STARS,
  type SubscriptionPlan,
} from '@tma80/shared';

import type { Db } from './client.ts';
import { events, subscriptions, users } from './schema.ts';
import type { Executor, UserRow } from './users.ts';

export type SubscriptionRow = typeof subscriptions.$inferSelect;

/**
 * Whether the user has an active monthly plan: a Telegram Stars subscription that renews itself.
 * A second one would be charged in parallel, so a new monthly invoice is refused (decision 0021).
 */
export async function hasActiveMonth(db: Executor, userId: string, now: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.plan, 'month'),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.expiresAt, now),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export type RecordPaymentResult =
  | { kind: 'recorded'; subscription: SubscriptionRow }
  | { kind: 'duplicate' }
  | { kind: 'unknown_user' };

/**
 * `successful_payment` (ТЗ, «Оплата в Stars»): one `subscriptions` record per payment, renewals
 * included, plus the `payment_success` event — in one transaction.
 * - Idempotent by `telegram_payment_charge_id`: a repeated update records nothing.
 * - The user comes from the payload, if it is ours and belongs to the payer, else by the payer's
 *   `tg_id`; the plan — from the payload if the amount is its price, else by the amount (the Stars
 *   are already charged, so the payment is recorded anyway).
 * - The period starts when the active subscription ends (`paymentPeriod`); the user row is locked,
 *   so parallel payments of one user stack correctly.
 */
export async function recordPayment(
  db: Db,
  payment: SuccessfulPayment,
  payerTgId: number,
  now: Date,
): Promise<RecordPaymentResult> {
  const parsed = parseInvoicePayload(payment.invoice_payload);
  // The plan of our payload if the amount is its price, else the plan with this price.
  const plan: SubscriptionPlan =
    (parsed !== null && SUBSCRIPTION_PRICES_STARS[parsed.plan] === payment.total_amount
      ? parsed.plan
      : planByStars(payment.total_amount)) ??
    parsed?.plan ??
    (payment.subscription_expiration_date === undefined ? 'year' : 'month');
  const isRenewal = payment.is_recurring === true && payment.is_first_recurring !== true;

  return db.transaction(async (tx) => {
    const user = await lockPayer(tx, parsed?.userId ?? null, payerTgId);
    if (!user) return { kind: 'unknown_user' } as const;

    const [current] = await tx
      .select({ expiresAt: max(subscriptions.expiresAt) })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.expiresAt, now),
        ),
      );
    const period = paymentPeriod(
      plan,
      current?.expiresAt?.toISOString() ?? null,
      payment.subscription_expiration_date === undefined
        ? null
        : new Date(payment.subscription_expiration_date * 1000),
      now,
    );

    const [row] = await tx
      .insert(subscriptions)
      .values({
        userId: user.id,
        plan,
        starsAmount: payment.total_amount,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        isRecurring: isRenewal,
        startsAt: period.startsAt,
        expiresAt: period.expiresAt,
        status: 'active',
        createdAt: now,
      })
      .onConflictDoNothing({ target: subscriptions.telegramPaymentChargeId })
      .returning();
    if (!row) return { kind: 'duplicate' } as const;

    await tx.insert(events).values({
      userId: user.id,
      name: 'payment_success',
      props: { plan, stars_amount: payment.total_amount, is_recurring: isRenewal },
      createdAt: now,
    });
    return { kind: 'recorded', subscription: row } as const;
  });
}

/** The payer's row, locked: by the payload user if it is the payer, else by `tg_id`. */
async function lockPayer(
  tx: Executor,
  payloadUserId: string | null,
  payerTgId: number,
): Promise<UserRow | undefined> {
  const [row] = await tx
    .select()
    .from(users)
    .where(
      payloadUserId === null
        ? eq(users.tgId, payerTgId)
        : and(eq(users.id, payloadUserId), eq(users.tgId, payerTgId)),
    )
    .for('update');
  if (row || payloadUserId === null) return row;
  return lockPayer(tx, null, payerTgId);
}

/**
 * Marks the payment refunded (`refunded_payment`, `npm run payments:refund`): the record stops
 * giving access. Idempotent; `false` if there is no such payment.
 */
export async function markRefunded(db: Executor, chargeId: string): Promise<boolean> {
  const rows = await db
    .update(subscriptions)
    .set({ status: 'refunded' })
    .where(eq(subscriptions.telegramPaymentChargeId, chargeId))
    .returning({ id: subscriptions.id });
  return rows.length > 0;
}

/** A payment with the payer's `tg_id` (for refunds). */
export async function findPayment(
  db: Executor,
  chargeId: string,
): Promise<(SubscriptionRow & { tgId: number }) | undefined> {
  const [row] = await db
    .select({ subscription: subscriptions, tgId: users.tgId })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(eq(subscriptions.telegramPaymentChargeId, chargeId))
    .limit(1);
  return row === undefined ? undefined : { ...row.subscription, tgId: row.tgId };
}

/** Why a checkout is refused: the invoice is outdated or foreign, or the month is already paid. */
export type CheckoutRefusal = 'stale' | 'other_user' | 'already_subscribed';

/**
 * `pre_checkout_query` (ТЗ, «Оплата в Stars»): the invoice is ours, in Stars, at the current price
 * of its plan, for an existing user who is the payer; a second monthly subscription is refused.
 * @returns `null` if the payment may proceed.
 */
export async function checkoutRefusal(
  db: Executor,
  query: { currency: string; total_amount: number; invoice_payload: string; from: { id: number } },
  now: Date,
): Promise<CheckoutRefusal | null> {
  const payload = parseInvoicePayload(query.invoice_payload);
  if (
    payload === null ||
    query.currency !== STARS_CURRENCY ||
    query.total_amount !== SUBSCRIPTION_PRICES_STARS[payload.plan]
  ) {
    return 'stale';
  }
  const [user] = await db
    .select({ tgId: users.tgId })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);
  if (!user) return 'stale';
  if (user.tgId !== query.from.id) return 'other_user';
  if (payload.plan === 'month' && (await hasActiveMonth(db, payload.userId, now))) {
    return 'already_subscribed';
  }
  return null;
}
