import { describe, expect, it } from 'vitest';

import { botToken } from './config.ts';

describe('botToken', () => {
  it('returns BOT_TOKEN', () => {
    expect(botToken({ BOT_TOKEN: ' 1:abc ' })).toBe('1:abc');
  });

  it('fails with a readable error without it', () => {
    expect(() => botToken({})).toThrow(/BOT_TOKEN is not set/);
    expect(() => botToken({ BOT_TOKEN: ' ' })).toThrow(/BOT_TOKEN is not set/);
  });
});
