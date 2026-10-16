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
