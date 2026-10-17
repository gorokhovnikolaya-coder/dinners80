import { z } from 'zod/mini';

import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from './constants.ts';

/**
 * Prices of the plans in Telegram Stars (decision of the product owner, 2026-10-16): the server
 * puts them into the invoice (`createInvoiceLink`), the paywall shows them.
 */
export const SUBSCRIPTION_PRICES_STARS: Readonly<Record<SubscriptionPlan, number>> = {
  month: 150,
  year: 1200,
};

/**
 * Length of a paid period in days: the month is a Telegram Stars subscription renewed every 30
 * days (`subscription_period` = 2592000 s), the year is a one-off payment for 365 days (ТЗ).
 */
export const SUBSCRIPTION_PERIOD_DAYS: Readonly<Record<SubscriptionPlan, number>> = {
  month: 30,
  year: 365,
};

/** Months a plan covers — for the «≈ 100 Stars в месяц» of the year plan. */
const PLAN_MONTHS: Readonly<Record<SubscriptionPlan, number>> = { month: 1, year: 12 };

/** Price of the plan per month, rounded to whole Stars (year 1200 → 100). */
export function monthlyPriceStars(plan: SubscriptionPlan): number {
  return Math.round(SUBSCRIPTION_PRICES_STARS[plan] / PLAN_MONTHS[plan]);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The period a new payment pays for. A purchase while a subscription is active starts when the
 * current period ends (ТЗ, «Оплата в Stars»); otherwise it starts now.
 * @param currentExpiresAt - end of the active subscription, `null` if there is none.
 */
export function subscriptionPeriod(
  plan: SubscriptionPlan,
  currentExpiresAt: string | null,
  now: Date,
): { startsAt: Date; expiresAt: Date } {
  const current = currentExpiresAt === null ? Number.NaN : Date.parse(currentExpiresAt);
  const start = Number.isFinite(current) && current > now.getTime() ? current : now.getTime();
  return {
    startsAt: new Date(start),
    expiresAt: new Date(start + SUBSCRIPTION_PERIOD_DAYS[plan] * DAY_MS),
  };
}

/** Body of `POST /api/payments/invoice`: the plan to pay for; the server sets the price. */
export const createInvoiceRequestSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
});
export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;

/**
 * Response of `POST /api/payments/invoice`: the Telegram invoice link (`createInvoiceLink`,
 * `https://t.me/$<slug>`) that the client opens with `openInvoice`.
 */
export const createInvoiceResponseSchema = z.object({
  invoiceLink: z.url({ protocol: /^https$/ }),
});
export type CreateInvoiceResponse = z.infer<typeof createInvoiceResponseSchema>;

/** Currency of Telegram Stars in invoices and payments. */
export const STARS_CURRENCY = 'XTR';

/**
 * `subscription_period` of the monthly invoice: Telegram allows only 30 days (2592000 s) for Stars
 * subscriptions.
 */
export const SUBSCRIPTION_PERIOD_SECONDS = SUBSCRIPTION_PERIOD_DAYS.month * 24 * 60 * 60;

/** What the bot puts into an invoice (`invoice_payload`): the plan and our user id. */
export interface InvoicePayload {
  plan: SubscriptionPlan;
  userId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `invoice_payload` of a plan invoice: `<plan>:<user uuid>` (≤ 128 bytes, decision 0021). */
export function invoicePayload({ plan, userId }: InvoicePayload): string {
  return `${plan}:${userId}`;
}

/** Parses `invoice_payload`; `null` if it is not ours (unknown plan, not a uuid). */
export function parseInvoicePayload(payload: string): InvoicePayload | null {
  const [plan, userId, ...rest] = payload.split(':');
  if (rest.length > 0 || userId === undefined || !UUID_RE.test(userId)) return null;
  const known = SUBSCRIPTION_PLANS.find((value) => value === plan);
  return known === undefined ? null : { plan: known, userId: userId.toLowerCase() };
}

/** The plan with this price in Stars, `null` if none: a fallback for a payment with a foreign payload. */
export function planByStars(amount: number): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((plan) => SUBSCRIPTION_PRICES_STARS[plan] === amount) ?? null;
}

/**
 * How far `subscription_expiration_date` may fall short of a full plan period after the start and
 * still be taken as is: Telegram counts the period from its own charge time, we — from the end of
 * the previous record, and the two differ by the delivery delay of the update.
 */
const EXPIRATION_TOLERANCE_MS = DAY_MS;

/**
 * The period a `successful_payment` pays for (ТЗ, «Оплата в Stars»): it starts when the active
 * subscription ends, or now (`subscriptionPeriod`). A monthly payment carries Telegram's
 * `subscription_expiration_date`, and the period ends then (a renewal thus moves `expires_at` to
 * Telegram's date). Only when that date is more than a day short of a full period after the start
 * — the month was stacked after a longer period, e.g. bought during the year — the period is a full
 * plan period, so a paid month is not cut short.
 * @param subscriptionExpiration - `subscription_expiration_date` of the payment, `null` if absent.
 */
export function paymentPeriod(
  plan: SubscriptionPlan,
  currentExpiresAt: string | null,
  subscriptionExpiration: Date | null,
  now: Date,
): { startsAt: Date; expiresAt: Date } {
  const period = subscriptionPeriod(plan, currentExpiresAt, now);
  if (
    subscriptionExpiration !== null &&
    subscriptionExpiration.getTime() >= period.expiresAt.getTime() - EXPIRATION_TOLERANCE_MS
  ) {
    return { startsAt: period.startsAt, expiresAt: subscriptionExpiration };
  }
  return period;
}
