import { describe, expect, it } from 'vitest';

import {
  SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PRICES_STARS,
  createInvoiceRequestSchema,
  createInvoiceResponseSchema,
  monthlyPriceStars,
  subscriptionPeriod,
} from './payments.ts';

const NOW = new Date('2026-10-16T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('plan prices', () => {
  it('are the approved prices in Stars', () => {
    expect(SUBSCRIPTION_PRICES_STARS).toEqual({ month: 150, year: 1200 });
    expect(SUBSCRIPTION_PERIOD_DAYS).toEqual({ month: 30, year: 365 });
  });

  it('gives the price per month: the year is cheaper', () => {
    expect(monthlyPriceStars('month')).toBe(150);
    expect(monthlyPriceStars('year')).toBe(100);
    expect(monthlyPriceStars('year')).toBeLessThan(monthlyPriceStars('month'));
  });
});

describe('subscriptionPeriod', () => {
  it('starts now without an active subscription', () => {
    expect(subscriptionPeriod('month', null, NOW)).toEqual({
      startsAt: NOW,
      expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
    });
    expect(subscriptionPeriod('year', null, NOW).expiresAt).toEqual(
      new Date(NOW.getTime() + 365 * DAY_MS),
    );
  });

  it('starts after the current period while a subscription is active', () => {
    const current = new Date(NOW.getTime() + 20 * DAY_MS);
    expect(subscriptionPeriod('year', current.toISOString(), NOW)).toEqual({
      startsAt: current,
      expiresAt: new Date(current.getTime() + 365 * DAY_MS),
    });
  });

  it('ignores an expired or malformed end date', () => {
    const expired = new Date(NOW.getTime() - DAY_MS).toISOString();
    expect(subscriptionPeriod('month', expired, NOW).startsAt).toEqual(NOW);
    expect(subscriptionPeriod('month', 'not a date', NOW).startsAt).toEqual(NOW);
  });
});

describe('invoice schemas', () => {
  it('accept a plan and an https invoice link', () => {
    expect(createInvoiceRequestSchema.parse({ plan: 'year' })).toEqual({ plan: 'year' });
    expect(createInvoiceRequestSchema.safeParse({ plan: 'week' }).success).toBe(false);
    expect(createInvoiceRequestSchema.safeParse({}).success).toBe(false);
    expect(createInvoiceResponseSchema.parse({ invoiceLink: 'https://t.me/$abc' })).toEqual({
      invoiceLink: 'https://t.me/$abc',
    });
    expect(
      createInvoiceResponseSchema.safeParse({ invoiceLink: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(createInvoiceResponseSchema.safeParse({ invoiceLink: '' }).success).toBe(false);
  });
});
