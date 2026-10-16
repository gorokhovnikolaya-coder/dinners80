import { afterAll, describe, expect, it } from 'vitest';

import { apiErrorSchema, healthResponseSchema } from '@tma80/shared';

import { buildApp } from './app.ts';
import { signInitData } from './auth/initData.ts';
import { connect } from './db/client.ts';

// pg connects lazily: these requests never reach the database.
const { db, pool } = connect('postgres://nobody@127.0.0.1:1/none');
const TOKEN = '1:test-token';
const app = buildApp({ db, botToken: TOKEN });

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/health', () => {
  it('responds with ok without Authorization', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
  });
});

describe('auth hook', () => {
  const expectError = (
    response: { statusCode: number; json: () => unknown },
    status: number,
    code: string,
  ) => {
    expect(response.statusCode).toBe(status);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe(code);
  };

  it('rejects POST /api/auth without initData', async () => {
    expectError(await app.inject({ method: 'POST', url: '/api/auth' }), 401, 'unauthorized');
  });

  it('rejects a forged signature', async () => {
    const raw = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: 1, first_name: 'X' }),
      },
      'another:token',
    );
    expectError(
      await app.inject({
        method: 'POST',
        url: '/api/auth',
        headers: { authorization: `tma ${raw}` },
      }),
      401,
      'unauthorized',
    );
  });

  it('answers unknown routes with not_found', async () => {
    expectError(await app.inject({ method: 'GET', url: '/api/nope' }), 404, 'not_found');
  });
});
