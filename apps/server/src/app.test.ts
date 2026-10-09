import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from '@tma80/shared';

import { buildApp } from './app.ts';

describe('GET /api/health', () => {
  it('responds with ok', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
    await app.close();
  });
});
