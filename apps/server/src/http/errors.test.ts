import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { safeErrorLog } from './errors.ts';

const pgError = () =>
  Object.assign(new Error('duplicate key value violates unique constraint "users_tg_id_unique"'), {
    code: '23505',
    constraint: 'users_tg_id_unique',
    detail: 'Key (tg_id)=(1002) already exists.',
  });

describe('safeErrorLog', () => {
  it('logs the Postgres message and code without the query parameters', () => {
    const error = new DrizzleQueryError(
      'insert into "users" ("first_name") values ($1)',
      ['Маша Секретова'],
      pgError(),
    );
    const log = safeErrorLog(error);
    expect(log).toEqual({
      name: 'Error',
      message: 'duplicate key value violates unique constraint "users_tg_id_unique"',
      pgCode: '23505',
      constraint: 'users_tg_id_unique',
    });
    expect(JSON.stringify(log)).not.toMatch(/Секретова|1002|insert/);
  });

  it('hides a Drizzle error without a cause', () => {
    const log = safeErrorLog(new DrizzleQueryError('select $1', ['secret']));
    expect(JSON.stringify(log)).not.toMatch(/secret/);
  });

  it('keeps message and stack of other errors', () => {
    const log = safeErrorLog(new TypeError('boom'));
    expect(log).toMatchObject({ name: 'TypeError', message: 'boom' });
    expect(log.stack).toContain('boom');
  });
});
