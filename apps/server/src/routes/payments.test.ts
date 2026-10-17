import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { Api, type Transformer } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  authResponseSchema,
  createInvoiceResponseSchema,
  FREE_COUNTRIES_LIMIT,
  invoicePayload,
  SUBSCRIPTION_PRICES_STARS,
  type SubscriptionPlan,
} from '@tma80/shared';

import { buildApp } from '../app.ts';
import { signInitData } from '../auth/initData.ts';
import { refundPayment } from '../bot/refund.ts';
import { webhookSecret } from '../bot/secret.ts';
import { CHECKOUT_REFUSAL_TEXTS, INVOICE_TEXTS } from '../bot/texts.ts';
import { connect, type Database } from '../db/client.ts';
import { cooks, countries, dishes, events, subscriptions, users } from '../db/schema.ts';
import { BOT_WEBHOOK_PATH } from './botWebhook.ts';

/**
 * Payments in Stars against a real database (`npm run test:db`): `POST /payments/invoice` and the
 * payment updates of the bot webhook. Bot API calls are intercepted by a transformer; users get
 * random `tg_id`s and are deleted afterwards (their subscriptions and cooks cascade).
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('payments in Stars', () => {
  const TOKEN = '42:test-bot-token';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const INVOICE_LINK = 'https://t.me/$test-invoice';
  const botInfo: UserFromGetMe = {
    id: 42,
    is_bot: true,
    first_name: 'Тест',
    username: 'tma80_test_bot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: true,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  let database: Database;
  let app: ReturnType<typeof buildApp>;
  let calls: { method: string; payload: Record<string, unknown> }[] = [];
  /** Methods to answer with a Bot API error: method → description. */
  let failures: Record<string, string> = {};
  const dishesByCountry: { countryId: string; dishIds: string[] }[] = [];
  const base = 8_200_000_000 + Math.floor(Math.random() * 1_000_000) * 100;
  let next = 0;
  let updateId = 0;
  const tgIds: number[] = [];

  const transformer: Transformer = (_prev, method, payload) => {
    calls.push({ method, payload: payload });
    const failure = failures[method];
    if (failure !== undefined) {
      return Promise.resolve({ ok: false, error_code: 400, description: failure });
    }
    return Promise.resolve({
      ok: true,
      result: (method === 'createInvoiceLink' ? INVOICE_LINK : true) as never,
    });
  };

  interface TestUser {
    id: string;
    tgId: number;
    authorization: string;
  }

  const newUser = async (): Promise<TestUser> => {
    next += 1;
    const tgId = base + next;
    tgIds.push(tgId);
    const authorization = `tma ${signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: tgId, first_name: `Плательщик ${String(tgId)}` }),
      },
      TOKEN,
    )}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization },
    });
    expect(response.statusCode).toBe(200);
    return { id: authResponseSchema.parse(response.json()).user.id, tgId, authorization };
  };

  const call = (user: TestUser | null, method: 'GET' | 'POST', url: string, body?: unknown) =>
    app.inject({
      method,
      url: `/api${url}`,
      headers: user === null ? {} : { authorization: user.authorization },
      ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    });

  const invoice = (user: TestUser | null, plan: unknown) =>
    call(user, 'POST', '/payments/invoice', { plan });

  const deliver = async (update: Omit<Update, 'update_id'>) => {
    updateId += 1;
    const response = await app.inject({
      method: 'POST',
      url: BOT_WEBHOOK_PATH,
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret(TOKEN) },
      payload: { update_id: updateId, ...update },
    });
    expect(response.statusCode).toBe(200);
  };

  const from = (tgId: number) => ({ id: tgId, is_bot: false, first_name: 'Плательщик' });

  const preCheckout = async (
    tgId: number,
    payload: string,
    amount: number,
    currency = 'XTR',
  ): Promise<Record<string, unknown> | undefined> => {
    calls = [];
    await deliver({
      pre_checkout_query: {
        id: `q${String(updateId)}`,
        from: from(tgId),
        currency,
        total_amount: amount,
        invoice_payload: payload,
      },
    });
    return calls.find((item) => item.method === 'answerPreCheckoutQuery')?.payload;
  };

  const serviceMessage = (tgId: number, fields: Record<string, unknown>) =>
    deliver({
      message: {
        message_id: updateId + 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: tgId, type: 'private', first_name: 'x' },
        from: from(tgId),
        ...fields,
      } as never,
    });

  interface Payment {
    plan: SubscriptionPlan;
    chargeId: string;
    payload?: string;
    amount?: number;
    /** `subscription_expiration_date` as a Date. */
    expiration?: Date;
    recurring?: 'first' | 'renewal';
  }

  const pay = (user: TestUser, payment: Payment) =>
    serviceMessage(user.tgId, {
      successful_payment: {
        currency: 'XTR',
        total_amount: payment.amount ?? SUBSCRIPTION_PRICES_STARS[payment.plan],
        invoice_payload: payment.payload ?? invoicePayload({ plan: payment.plan, userId: user.id }),
        telegram_payment_charge_id: payment.chargeId,
        provider_payment_charge_id: '',
        ...(payment.expiration === undefined
          ? {}
          : { subscription_expiration_date: Math.floor(payment.expiration.getTime() / 1000) }),
        ...(payment.recurring === undefined ? {} : { is_recurring: true }),
        ...(payment.recurring === 'first' ? { is_first_recurring: true } : {}),
      },
    });

  const chargeId = () => `test-charge-${String(base)}-${String((updateId += 1))}`;

  const subscriptionsOf = (userId: string) =>
    database.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(asc(subscriptions.startsAt));

  const paymentEvents = (userId: string) =>
    database.db
      .select({ props: events.props })
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.name, 'payment_success')));

  /** Cooks of the first `n` countries: the user has `n` stamps. */
  const addCooks = async (user: TestUser, n: number) => {
    await database.db.insert(cooks).values(
      dishesByCountry.slice(0, n).map(({ countryId, dishIds }) => ({
        userId: user.id,
        dishId: dishIds[0] ?? '',
        countryId,
      })),
    );
  };

  const errorCode = (response: { json: () => unknown }) =>
    apiErrorSchema.parse(response.json()).error.code;

  beforeAll(async () => {
    database = connect();
    app = buildApp({
      db: database.db,
      botToken: TOKEN,
      mediaDir: join(tmpdir(), 'tma80-unused-media'),
      mediaSigningKey: 'k'.repeat(32),
      apiTransformer: transformer,
      bot: {
        webAppUrl: 'https://example.com/app',
        termsUrl: null,
        privacyUrl: null,
        supportContact: null,
        botInfo,
        apiTransformer: transformer,
      },
    });
    const rows = await database.db
      .select({ countryId: dishes.countryId, dishId: dishes.id })
      .from(dishes)
      .innerJoin(countries, eq(countries.id, dishes.countryId))
      .where(and(eq(countries.isPublished, true), eq(dishes.isPublished, true)))
      .orderBy(asc(countries.sort), asc(dishes.id));
    for (const row of rows) {
      const group = dishesByCountry.find((item) => item.countryId === row.countryId);
      if (group) group.dishIds.push(row.dishId);
      else dishesByCountry.push({ countryId: row.countryId, dishIds: [row.dishId] });
    }
    expect(dishesByCountry.length).toBeGreaterThan(FREE_COUNTRIES_LIMIT);
  });

  beforeEach(() => {
    calls = [];
    failures = {};
  });

  afterAll(async () => {
    const created = await database.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.tgId, tgIds));
    const ids = created.map((row) => row.id);
    if (ids.length > 0) {
      await database.db.delete(events).where(inArray(events.userId, ids));
      await database.db.delete(users).where(inArray(users.id, ids));
    }
    await app.close();
    await database.pool.end();
  });

  describe('POST /payments/invoice', () => {
    it('creates a one-off Stars invoice for the year', async () => {
      const user = await newUser();
      const response = await invoice(user, 'year');
      expect(response.statusCode).toBe(201);
      expect(createInvoiceResponseSchema.parse(response.json())).toEqual({
        invoiceLink: INVOICE_LINK,
      });
      expect(calls).toEqual([
        {
          method: 'createInvoiceLink',
          payload: {
            title: INVOICE_TEXTS.year.title,
            description: INVOICE_TEXTS.year.description,
            payload: `year:${user.id}`,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: INVOICE_TEXTS.year.title, amount: 1200 }],
          },
        },
      ]);
    });

    it('makes the month a 30-day Stars subscription', async () => {
      const user = await newUser();
      expect((await invoice(user, 'month')).statusCode).toBe(201);
      expect(calls[0]?.payload).toMatchObject({
        payload: `month:${user.id}`,
        prices: [{ label: INVOICE_TEXTS.month.title, amount: 150 }],
        subscription_period: 2_592_000,
      });
    });

    it('checks the plan and the user; a Bot API error is a 500', async () => {
      const user = await newUser();
      const wrong = await invoice(user, 'week');
      expect(wrong.statusCode).toBe(400);
      expect(errorCode(wrong)).toBe('validation');
      expect((await invoice(null, 'year')).statusCode).toBe(401);
      expect(calls).toEqual([]);

      failures = { createInvoiceLink: 'Bad Request: something' };
      const failed = await invoice(user, 'year');
      expect(failed.statusCode).toBe(500);
      expect(errorCode(failed)).toBe('internal');
    });

    it('refuses a second month while one is active, the year is allowed', async () => {
      const user = await newUser();
      await pay(user, { plan: 'month', chargeId: chargeId(), recurring: 'first' });

      const month = await invoice(user, 'month');
      expect(month.statusCode).toBe(409);
      expect(errorCode(month)).toBe('conflict');
      expect((await invoice(user, 'year')).statusCode).toBe(201);
    });
  });

  describe('pre_checkout_query', () => {
    it('accepts our invoice at the current price from its user', async () => {
      const user = await newUser();
      for (const plan of ['month', 'year'] as const) {
        expect(
          await preCheckout(
            user.tgId,
            invoicePayload({ plan, userId: user.id }),
            SUBSCRIPTION_PRICES_STARS[plan],
          ),
        ).toMatchObject({ ok: true });
      }
    });

    it('refuses outdated, foreign and repeated monthly invoices', async () => {
      const user = await newUser();
      const other = await newUser();
      const month = invoicePayload({ plan: 'month', userId: user.id });
      const stale = { ok: false, error_message: CHECKOUT_REFUSAL_TEXTS.stale };

      expect(await preCheckout(user.tgId, month, 100)).toMatchObject(stale);
      expect(await preCheckout(user.tgId, month, 150, 'USD')).toMatchObject(stale);
      expect(await preCheckout(user.tgId, 'something-else', 150)).toMatchObject(stale);
      expect(
        await preCheckout(
          user.tgId,
          invoicePayload({ plan: 'month', userId: '00000000-0000-4000-8000-000000000000' }),
          150,
        ),
      ).toMatchObject(stale);
      expect(await preCheckout(other.tgId, month, 150)).toMatchObject({
        ok: false,
        error_message: CHECKOUT_REFUSAL_TEXTS.other_user,
      });

      await pay(user, { plan: 'month', chargeId: chargeId(), recurring: 'first' });
      expect(await preCheckout(user.tgId, month, 150)).toMatchObject({
        ok: false,
        error_message: CHECKOUT_REFUSAL_TEXTS.already_subscribed,
      });
      expect(
        await preCheckout(user.tgId, invoicePayload({ plan: 'year', userId: user.id }), 1200),
      ).toMatchObject({ ok: true });
    });

    it('lets a month through near the end of the active one: a renewal is never refused', async () => {
      const user = await newUser();
      const charge = chargeId();
      await pay(user, { plan: 'month', chargeId: charge, recurring: 'first' });
      const month = invoicePayload({ plan: 'month', userId: user.id });
      const refused = { ok: false, error_message: CHECKOUT_REFUSAL_TEXTS.already_subscribed };

      // Middle of the period: refused.
      await database.db
        .update(subscriptions)
        .set({ expiresAt: new Date(Date.now() + 15 * DAY_MS) })
        .where(eq(subscriptions.telegramPaymentChargeId, charge));
      expect(await preCheckout(user.tgId, month, 150)).toMatchObject(refused);

      // A day before the end: accepted (the invoice endpoint still answers 409).
      await database.db
        .update(subscriptions)
        .set({ expiresAt: new Date(Date.now() + DAY_MS) })
        .where(eq(subscriptions.telegramPaymentChargeId, charge));
      expect(await preCheckout(user.tgId, month, 150)).toMatchObject({ ok: true });
      expect((await invoice(user, 'month')).statusCode).toBe(409);
    });
  });

  describe('successful_payment', () => {
    it('done: a test payment opens the 11th country, a repeated webhook records nothing', async () => {
      const user = await newUser();
      await addCooks(user, FREE_COUNTRIES_LIMIT);
      const closed = dishesByCountry[FREE_COUNTRIES_LIMIT]?.dishIds[0] ?? '';
      const before = await call(user, 'GET', `/dishes/${closed}`);
      expect(before.statusCode).toBe(403);
      expect(errorCode(before)).toBe('paywall');

      const charge = chargeId();
      const startedAt = Date.now();
      await pay(user, { plan: 'year', chargeId: charge });
      expect((await call(user, 'GET', `/dishes/${closed}`)).statusCode).toBe(200);

      const [record, ...rest] = await subscriptionsOf(user.id);
      expect(rest).toEqual([]);
      expect(record).toMatchObject({
        plan: 'year',
        starsAmount: 1200,
        telegramPaymentChargeId: charge,
        isRecurring: false,
        status: 'active',
      });
      const length = (record?.expiresAt.getTime() ?? 0) - (record?.startsAt.getTime() ?? 0);
      expect(length).toBe(365 * DAY_MS);
      expect(record?.startsAt.getTime()).toBeGreaterThanOrEqual(startedAt - 1000);
      expect(await paymentEvents(user.id)).toEqual([
        { props: { plan: 'year', stars_amount: 1200, is_recurring: false } },
      ]);
      // The bot sends nothing after a payment.
      expect(calls.filter((item) => item.method === 'sendMessage')).toEqual([]);

      // Telegram repeats the update: still one subscription and one event.
      await pay(user, { plan: 'year', chargeId: charge });
      expect(await subscriptionsOf(user.id)).toHaveLength(1);
      expect(await paymentEvents(user.id)).toHaveLength(1);
    });

    it('done: a renewal moves expires_at to subscription_expiration_date', async () => {
      const user = await newUser();
      const firstEnd = new Date(Date.now() + 30 * DAY_MS);
      await pay(user, {
        plan: 'month',
        chargeId: chargeId(),
        expiration: firstEnd,
        recurring: 'first',
      });
      const renewalEnd = new Date(firstEnd.getTime() + 30 * DAY_MS);
      await pay(user, {
        plan: 'month',
        chargeId: chargeId(),
        expiration: renewalEnd,
        recurring: 'renewal',
      });

      const [first, renewal] = await subscriptionsOf(user.id);
      expect(first).toMatchObject({ isRecurring: false });
      expect(first?.expiresAt.getTime()).toBe(Math.floor(firstEnd.getTime() / 1000) * 1000);
      expect(renewal).toMatchObject({ isRecurring: true, starsAmount: 150 });
      expect(renewal?.startsAt).toEqual(first?.expiresAt);
      expect(renewal?.expiresAt.getTime()).toBe(Math.floor(renewalEnd.getTime() / 1000) * 1000);
      expect((await paymentEvents(user.id)).map((event) => event.props)).toEqual([
        { plan: 'month', stars_amount: 150, is_recurring: false },
        { plan: 'month', stars_amount: 150, is_recurring: true },
      ]);

      const auth = authResponseSchema.parse(
        (await call(user, 'POST', '/auth')).json(),
      ).subscription;
      expect(auth).toEqual({
        active: true,
        plan: 'month',
        expiresAt: renewal?.expiresAt.toISOString(),
      });
    });

    it('a purchase during an active subscription starts when it ends', async () => {
      const user = await newUser();
      await pay(user, { plan: 'month', chargeId: chargeId(), recurring: 'first' });
      await pay(user, { plan: 'year', chargeId: chargeId() });
      const [month, year] = await subscriptionsOf(user.id);
      expect(year?.plan).toBe('year');
      expect(year?.startsAt).toEqual(month?.expiresAt);
      expect((year?.expiresAt.getTime() ?? 0) - (year?.startsAt.getTime() ?? 0)).toBe(365 * DAY_MS);
    });

    it('records a payment with a foreign payload for the payer, by the amount', async () => {
      const user = await newUser();
      const other = await newUser();
      await pay(user, {
        plan: 'month',
        chargeId: chargeId(),
        payload: invoicePayload({ plan: 'year', userId: other.id }),
        amount: 150,
      });
      await pay(user, { plan: 'year', chargeId: chargeId(), payload: 'legacy' });
      expect((await subscriptionsOf(user.id)).map((row) => row.plan)).toEqual(['month', 'year']);
      expect(await subscriptionsOf(other.id)).toEqual([]);
    });

    it('ignores a payment of an unknown user without failing the update', async () => {
      next += 1;
      const stranger = base + next;
      tgIds.push(stranger);
      const charge = chargeId();
      await serviceMessage(stranger, {
        successful_payment: {
          currency: 'XTR',
          total_amount: 150,
          invoice_payload: 'month:00000000-0000-4000-8000-000000000000',
          telegram_payment_charge_id: charge,
          provider_payment_charge_id: '',
        },
      });
      expect(
        await database.db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.telegramPaymentChargeId, charge)),
      ).toEqual([]);
    });
  });

  describe('refunds', () => {
    it('refunded_payment closes the access again', async () => {
      const user = await newUser();
      await addCooks(user, FREE_COUNTRIES_LIMIT);
      const closed = dishesByCountry[FREE_COUNTRIES_LIMIT]?.dishIds[0] ?? '';
      const charge = chargeId();
      await pay(user, { plan: 'year', chargeId: charge });
      expect((await call(user, 'GET', `/dishes/${closed}`)).statusCode).toBe(200);

      const refunded = {
        refunded_payment: {
          currency: 'XTR',
          total_amount: 1200,
          invoice_payload: invoicePayload({ plan: 'year', userId: user.id }),
          telegram_payment_charge_id: charge,
        },
      };
      await serviceMessage(user.tgId, refunded);
      await serviceMessage(user.tgId, refunded);
      expect((await subscriptionsOf(user.id)).map((row) => row.status)).toEqual(['refunded']);
      expect((await call(user, 'GET', `/dishes/${closed}`)).statusCode).toBe(403);
    });

    it('payments:refund cancels the renewal of the month, refunds and marks the record', async () => {
      const user = await newUser();
      const charge = chargeId();
      await pay(user, { plan: 'month', chargeId: charge, recurring: 'first' });
      const api = new Api(TOKEN);
      api.config.use(transformer);
      calls = [];

      expect(await refundPayment(database.db, api, charge)).toEqual({
        kind: 'refunded',
        renewalCancelled: true,
      });
      expect(calls).toEqual([
        {
          method: 'editUserStarSubscription',
          payload: { user_id: user.tgId, telegram_payment_charge_id: charge, is_canceled: true },
        },
        {
          method: 'refundStarPayment',
          payload: { user_id: user.tgId, telegram_payment_charge_id: charge },
        },
      ]);
      expect((await subscriptionsOf(user.id))[0]?.status).toBe('refunded');
      expect(await refundPayment(database.db, api, charge)).toEqual({ kind: 'already_refunded' });
      expect(await refundPayment(database.db, api, 'no-such-charge')).toEqual({
        kind: 'not_found',
      });
    });

    it('payments:refund marks a charge Telegram has already refunded; other errors throw', async () => {
      const user = await newUser();
      const api = new Api(TOKEN);
      api.config.use(transformer);

      const done = chargeId();
      await pay(user, { plan: 'year', chargeId: done });
      failures = { refundStarPayment: 'Bad Request: CHARGE_ALREADY_REFUNDED' };
      expect(await refundPayment(database.db, api, done)).toEqual({
        kind: 'refunded',
        renewalCancelled: null,
      });

      const failing = chargeId();
      await pay(user, { plan: 'year', chargeId: failing });
      failures = { refundStarPayment: 'Bad Request: CHARGE_NOT_FOUND' };
      await expect(refundPayment(database.db, api, failing)).rejects.toThrow('CHARGE_NOT_FOUND');
      const rows = await subscriptionsOf(user.id);
      expect(rows.find((row) => row.telegramPaymentChargeId === failing)?.status).toBe('active');
    });
  });
});
