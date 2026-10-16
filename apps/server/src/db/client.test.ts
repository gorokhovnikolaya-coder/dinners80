import { describe, expect, it } from 'vitest';

import { databaseUrl } from './client.ts';

describe('databaseUrl', () => {
  it('returns DATABASE_URL', () => {
    expect(databaseUrl({ DATABASE_URL: 'postgres://u@localhost/db' })).toBe(
      'postgres://u@localhost/db',
    );
  });

  it('fails with a readable error without it', () => {
    expect(() => databaseUrl({})).toThrow(/DATABASE_URL is not set/);
    expect(() => databaseUrl({ DATABASE_URL: '' })).toThrow(/DATABASE_URL is not set/);
  });
});
