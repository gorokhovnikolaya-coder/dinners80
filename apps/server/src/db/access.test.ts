import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `has_access` and `user_countries` against a real database. Needs a migrated and seeded local
 * database (`npm run db:reset`) and `DATABASE_URL`; skipped otherwise, so `npm run check` does not
 * need Docker. Everything runs in a transaction that is rolled back.
 */
const url = process.env.DATABASE_URL;

describe.skipIf(url === undefined)('has_access and user_countries', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('begin');
  });

  afterAll(async () => {
    await client.query('rollback');
    await client.end();
  });

  const one = async <T>(text: string, values: unknown[] = []) =>
    (await client.query(text, values)).rows[0] as T;

  const access = async (userId: string, countryId: string) =>
    (await one<{ ok: boolean }>('select has_access($1, $2) as ok', [userId, countryId])).ok;

  it('opens any country until 10 are passed, then passed ones and the subscription', async () => {
    const { id: userId } = await one<{ id: string }>(
      `insert into users (tg_id, first_name, invite_code) values (990001, 'Тест', 'test-access') returning id`,
    );
    const countries = (
      await client.query<{ id: string }>('select id from countries order by sort limit 11')
    ).rows.map((row) => row.id);
    const [eleventh] = countries.slice(10);
    expect(eleventh).toBeDefined();
    if (eleventh === undefined) return;

    expect(await access(userId, eleventh)).toBe(true);

    for (const countryId of countries.slice(0, 10)) {
      await client.query(
        `insert into cooks (user_id, dish_id, country_id)
         select $1, id, country_id from dishes where country_id = $2 limit 1`,
        [userId, countryId],
      );
    }
    expect(await access(userId, eleventh)).toBe(false);
    expect(await access(userId, countries[0] ?? '')).toBe(true);

    const passed = await one<{ count: string }>(
      'select count(*) from user_countries where user_id = $1',
      [userId],
    );
    expect(Number(passed.count)).toBe(10);

    const insertSubscription = (charge: string, status: string, expires: string) =>
      client.query(
        `insert into subscriptions (user_id, plan, stars_amount, telegram_payment_charge_id, starts_at, expires_at, status)
         values ($1, 'month', 150, $2, now() - interval '40 days', ${expires}, $3)`,
        [userId, charge, status],
      );
    await insertSubscription('expired-1', 'active', `now() - interval '1 day'`);
    expect(await access(userId, eleventh)).toBe(false);
    await insertSubscription('refunded-1', 'refunded', `now() + interval '10 days'`);
    expect(await access(userId, eleventh)).toBe(false);
    await insertSubscription('active-1', 'active', `now() + interval '10 days'`);
    expect(await access(userId, eleventh)).toBe(true);
  });

  it('rejects a cook whose country is not the dish country', async () => {
    await client.query('savepoint mismatch');
    const { id: userId } = await one<{ id: string }>(
      `insert into users (tg_id, first_name, invite_code) values (990002, 'Тест', 'test-mismatch') returning id`,
    );
    await expect(
      client.query(
        `insert into cooks (user_id, dish_id, country_id) values ($1, 'it-carbonara', 'fr')`,
        [userId],
      ),
    ).rejects.toThrow(/cooks_dish_country_fk/);
    await client.query('rollback to savepoint mismatch');
  });
});
