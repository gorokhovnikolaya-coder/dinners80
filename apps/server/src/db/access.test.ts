import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FREE_COUNTRIES_LIMIT } from '@tma80/shared';

import { databaseUrl } from './client.ts';

/**
 * `has_access` and `user_countries` against a real database: `npm run test:db` after
 * `npm run db:reset` (sets `TEST_DATABASE=1`, `DATABASE_URL` comes from `.env`). Skipped in
 * `npm run check`, which needs no Docker. Everything runs in one transaction that is rolled back.
 * The free limit comes from `FREE_COUNTRIES_LIMIT`, so the SQL function cannot drift from it.
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('has_access and user_countries', () => {
  let client: pg.Client;
  /** Published countries in map order; at least `FREE_COUNTRIES_LIMIT + 1`. */
  let countries: string[] = [];
  let users = 0;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl() });
    await client.connect();
    await client.query('begin');
    countries = (
      await client.query<{ id: string }>('select id from countries order by sort')
    ).rows.map((row) => row.id);
    expect(countries.length).toBeGreaterThan(FREE_COUNTRIES_LIMIT);
  });

  afterAll(async () => {
    await client.query('rollback');
    await client.end();
  });

  const country = (index: number) => {
    const id = countries[index];
    if (id === undefined) throw new Error(`no country #${String(index)}`);
    return id;
  };

  const newUser = async () => {
    users += 1;
    const result = await client.query<{ id: string }>(
      `insert into users (tg_id, first_name, invite_code) values ($1, 'Тест', $2) returning id`,
      [990000 + users, `test-access-${String(users)}`],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error('user not created');
    return id;
  };

  /** A cook of the first dish of the country, `daysAgo` days back. */
  const cook = (userId: string, countryId: string, daysAgo = 0) =>
    client.query(
      `insert into cooks (user_id, dish_id, country_id, created_at)
       select $1, id, country_id, now() - make_interval(days => $3)
       from dishes where country_id = $2 order by id limit 1`,
      [userId, countryId, daysAgo],
    );

  const cookFirst = async (userId: string, count: number) => {
    for (let index = 0; index < count; index += 1) await cook(userId, country(index));
  };

  const access = async (userId: string, countryId: string) => {
    const result = await client.query<{ ok: boolean }>('select has_access($1, $2) as ok', [
      userId,
      countryId,
    ]);
    return result.rows[0]?.ok;
  };

  const passed = async (userId: string) =>
    (
      await client.query<{ country_id: string; first_stamp_at: Date }>(
        'select country_id, first_stamp_at from user_countries where user_id = $1',
        [userId],
      )
    ).rows;

  const subscribe = (userId: string, charge: string, status: string, expiresInDays: number) =>
    client.query(
      `insert into subscriptions (user_id, plan, stars_amount, telegram_payment_charge_id, starts_at, expires_at, status)
       values ($1, 'month', 150, $2, now() - interval '60 days', now() + make_interval(days => $4), $3)`,
      [userId, charge, status, expiresInDays],
    );

  it('opens any country to a new user', async () => {
    const userId = await newUser();
    expect(await access(userId, country(FREE_COUNTRIES_LIMIT))).toBe(true);
  });

  it('opens the next country with one free country left', async () => {
    const userId = await newUser();
    await cookFirst(userId, FREE_COUNTRIES_LIMIT - 1);
    expect(await access(userId, country(FREE_COUNTRIES_LIMIT))).toBe(true);
  });

  it('closes new countries once the limit is passed, keeps the passed ones open', async () => {
    const userId = await newUser();
    await cookFirst(userId, FREE_COUNTRIES_LIMIT);
    expect(await passed(userId)).toHaveLength(FREE_COUNTRIES_LIMIT);
    expect(await access(userId, country(FREE_COUNTRIES_LIMIT))).toBe(false);
    expect(await access(userId, country(0))).toBe(true);
  });

  it('does not count a repeated cook of the same country', async () => {
    const userId = await newUser();
    await cookFirst(userId, FREE_COUNTRIES_LIMIT - 1);
    await cook(userId, country(0));
    await cook(userId, country(0));
    expect(await passed(userId)).toHaveLength(FREE_COUNTRIES_LIMIT - 1);
    expect(await access(userId, country(FREE_COUNTRIES_LIMIT))).toBe(true);
  });

  it('dates the stamp by the earliest cook of the country', async () => {
    const userId = await newUser();
    await cook(userId, country(0), 1);
    await cook(userId, country(0), 5);
    await cook(userId, country(0), 3);
    const earliest = await client.query<{ at: Date }>(
      'select min(created_at) as at from cooks where user_id = $1',
      [userId],
    );
    const rows = await passed(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.first_stamp_at).toEqual(earliest.rows[0]?.at);
  });

  it('gives access only with an active, unexpired subscription', async () => {
    const userId = await newUser();
    await cookFirst(userId, FREE_COUNTRIES_LIMIT);
    const closed = country(FREE_COUNTRIES_LIMIT);

    await subscribe(userId, `expired-${userId}`, 'active', -1);
    expect(await access(userId, closed)).toBe(false);
    await subscribe(userId, `refunded-${userId}`, 'refunded', 10);
    expect(await access(userId, closed)).toBe(false);
    await subscribe(userId, `ended-${userId}`, 'expired', 10);
    expect(await access(userId, closed)).toBe(false);
    // Passed countries stay open after the subscription ended or was refunded.
    expect(await access(userId, country(0))).toBe(true);

    await subscribe(userId, `active-${userId}`, 'active', 10);
    expect(await access(userId, closed)).toBe(true);
  });

  it('rejects a cook whose country is not the dish country', async () => {
    const userId = await newUser();
    await client.query('savepoint mismatch');
    const dish = await client.query<{ id: string }>(
      'select id from dishes where country_id = $1 limit 1',
      [country(0)],
    );
    await expect(
      client.query('insert into cooks (user_id, dish_id, country_id) values ($1, $2, $3)', [
        userId,
        dish.rows[0]?.id,
        country(1),
      ]),
    ).rejects.toThrow(/cooks_dish_country_fk/);
    await client.query('rollback to savepoint mismatch');
  });
});
