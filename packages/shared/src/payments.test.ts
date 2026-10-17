import { describe, expect, it } from 'vitest';

import {
  SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PRICES_STARS,
  createInvoiceRequestSchema,
  createInvoiceResponseSchema,
  SUBSCRIPTION_PERIOD_SECONDS,
  invoicePayload,
  monthlyPriceStars,
  parseInvoicePayload,
  paymentPeriod,
  planByStars,
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

describe('invoice payload', () => {
  const userId = '0b6f3c1e-8a2d-4c5b-9e7f-1a2b3c4d5e6f';

  it('round-trips the plan and the user, within 128 bytes', () => {
    for (const plan of ['month', 'year'] as const) {
      const payload = invoicePayload({ plan, userId });
      expect(payload).toMatch(/^[\x20-\x7e]{1,128}$/); // ASCII: bytes = characters
      expect(parseInvoicePayload(payload)).toEqual({ plan, userId });
    }
    expect(parseInvoicePayload(`year:${userId.toUpperCase()}`)).toEqual({ plan: 'year', userId });
  });

  it('rejects foreign payloads', () => {
    for (const payload of [
      '',
      'month',
      `week:${userId}`,
      'month:not-a-uuid',
      `month:${userId}:extra`,
      `:${userId}`,
    ]) {
      expect(parseInvoicePayload(payload)).toBeNull();
    }
  });
});

describe('planByStars', () => {
  it('finds the plan by its price', () => {
    expect(planByStars(150)).toBe('month');
    expect(planByStars(1200)).toBe('year');
    expect(planByStars(1)).toBeNull();
  });
});

describe('paymentPeriod', () => {
  it('is the 30-day Telegram subscription period', () => {
    expect(SUBSCRIPTION_PERIOD_SECONDS).toBe(2_592_000);
  });

  it('ends at subscription_expiration_date of a renewal', () => {
    const currentEnd = new Date(NOW.getTime() + 60_000);
    const telegramEnd = new Date(currentEnd.getTime() + 30 * DAY_MS + 5_000);
    expect(paymentPeriod('month', currentEnd.toISOString(), telegramEnd, NOW)).toEqual({
      startsAt: currentEnd,
      expiresAt: telegramEnd,
    });
  });

  it("takes Telegram's date even a little earlier than a full period after the start", () => {
    const currentEnd = new Date(NOW.getTime() + 60_000);
    const telegramEnd = new Date(currentEnd.getTime() + 30 * DAY_MS - 30_000);
    expect(paymentPeriod('month', currentEnd.toISOString(), telegramEnd, NOW).expiresAt).toEqual(
      telegramEnd,
    );
    expect(
      paymentPeriod('month', null, new Date(NOW.getTime() + 29 * DAY_MS), NOW).expiresAt,
    ).toEqual(new Date(NOW.getTime() + 29 * DAY_MS));
  });

  it('is a full plan period when stacked after a longer one', () => {
    // A month bought during the year: Telegram's date is long before the year ends.
    const yearEnd = new Date(NOW.getTime() + 100 * DAY_MS);
    const telegramEnd = new Date(NOW.getTime() + 30 * DAY_MS);
    expect(paymentPeriod('month', yearEnd.toISOString(), telegramEnd, NOW)).toEqual({
      startsAt: yearEnd,
      expiresAt: new Date(yearEnd.getTime() + 30 * DAY_MS),
    });
  });

  it('without subscription_expiration_date is the plan period', () => {
    expect(paymentPeriod('year', null, null, NOW)).toEqual(subscriptionPeriod('year', null, NOW));
  });
});
