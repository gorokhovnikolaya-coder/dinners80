import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databaseUrl } from '../db/client.ts';
import { queryMetrics } from './metrics.ts';

/**
 * The metrics query against a real database: `npm run test:db` after `npm run db:reset`. Runs in
 * one transaction that is rolled back; the period lies in the past so other data does not mix in.
 */
describe.skipIf(process.env.TEST_DATABASE !== '1')('queryMetrics', () => {
  let client: pg.Client;
  let dishes: { id: string; country_id: string }[] = [];
  let users = 0;
  const day = (n: number) => new Date(Date.UTC(2001, 0, 1 + n, 12));
  const from = day(0);
  const to = day(14);
  const TEAM_TG = 880001;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl() });
    await client.connect();
    await client.query('begin');
    dishes = (
      await client.query<{ id: string; country_id: string }>(
        'select id, country_id from dishes order by id limit 2',
      )
    ).rows;
    expect(dishes).toHaveLength(2);
  });

  afterAll(async () => {
    await client.query('rollback');
    await client.end();
  });

  const user = async (options: {
    tgId?: number;
    created: Date;
    onboarded?: Date;
    invitedBy?: string;
  }) => {
    users += 1;
    const result = await client.query<{ id: string }>(
      `insert into users (tg_id, first_name, invite_code, created_at, onboarded_at, invited_by)
       values ($1, 'Тест', $2, $3, $4, $5) returning id`,
      [
        options.tgId ?? 870000 + users,
        `test-metrics-${String(users)}`,
        options.created,
        options.onboarded ?? null,
        options.invitedBy ?? null,
      ],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error('user not created');
    return id;
  };
  const event = (userId: string, name: string, at: Date) =>
    client.query('insert into events (user_id, name, created_at) values ($1, $2, $3)', [
      userId,
      name,
      at,
    ]);
  const cook = (userId: string, dishIndex: number, at: Date, photo = false) => {
    const dish = dishes[dishIndex];
    if (dish === undefined) throw new Error('no dish');
    return client.query(
      `insert into cooks (user_id, dish_id, country_id, photo_path, created_at)
       values ($1, $2, $3, $4, $5)`,
      [userId, dish.id, dish.country_id, photo ? `${userId}/x.jpg` : null, at],
    );
  };

  it('counts the cohort, events, cooks and invitations of the period', async () => {
    const team = await user({ tgId: TEAM_TG, created: day(0), onboarded: day(0) });
    await cook(team, 0, day(1));
    await event(team, 'cook_started', day(1));

    // Starts within 7 days, two dishes within 14 days, one cook with a photo.
    const a = await user({ created: day(1), onboarded: day(1) });
    await event(a, 'cook_started', day(3));
    await event(a, 'cook_finished', day(3));
    await cook(a, 0, day(3), true);
    await event(a, 'cook_started', day(10));
    await event(a, 'cook_finished', day(10));
    await cook(a, 1, day(10));
    await event(a, 'payment_success', day(11));

    // Invited by `a`; starts on day 9 after onboarding — too late; one dish only.
    const b = await user({ created: day(2), onboarded: day(2), invitedBy: a });
    await event(b, 'cook_started', day(11));
    await cook(b, 0, day(11));

    // Invited by the team: not counted as an invitation; never onboarded.
    await user({ created: day(3), invitedBy: team });
    // Onboarded before the period: not in the cohort, but its cook makes it active.
    const old = await user({ created: day(-30), onboarded: day(-30) });
    await cook(old, 0, day(5));
    // Onboarded at the end of the period: windows are still open at `now`.
    await user({ created: day(13), onboarded: day(13) });

    const counts = await queryMetrics(client, { from, to, excludeTgIds: [TEAM_TG] }, day(16));
    expect(counts).toEqual({
      onboarded: 3,
      startedWithin7Days: 1,
      open7DayWindows: 1,
      twoDishesWithin14Days: 1,
      open14DayWindows: 1,
      cooksStarted: 3,
      cooksFinished: 2,
      cooks: 4,
      cooksWithPhoto: 1,
      activeUsers: 3,
      invitedUsers: 1,
      payments: 1,
    });
  });
});
