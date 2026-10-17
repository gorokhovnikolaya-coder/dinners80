import { describe, expect, it } from 'vitest';

import { botToken, mediaDir, mediaSigningKey } from './config.ts';

describe('botToken', () => {
  it('returns BOT_TOKEN', () => {
    expect(botToken({ BOT_TOKEN: ' 1:abc ' })).toBe('1:abc');
  });

  it('fails with a readable error without it', () => {
    expect(() => botToken({})).toThrow(/BOT_TOKEN is not set/);
    expect(() => botToken({ BOT_TOKEN: ' ' })).toThrow(/BOT_TOKEN is not set/);
  });
});

describe('mediaSigningKey', () => {
  it('returns a long enough key', () => {
    const key = 'a'.repeat(32);
    expect(mediaSigningKey({ MEDIA_SIGNING_KEY: ` ${key} ` })).toBe(key);
  });

  it('fails without it or with a short or unsafe one', () => {
    expect(() => mediaSigningKey({})).toThrow(/MEDIA_SIGNING_KEY is not set/);
    expect(() => mediaSigningKey({ MEDIA_SIGNING_KEY: 'short' })).toThrow(/at least 32/);
    expect(() => mediaSigningKey({ MEDIA_SIGNING_KEY: `${'a'.repeat(32)}"; x` })).toThrow();
  });
});

describe('mediaDir', () => {
  it('takes an absolute MEDIA_DIR or apps/server/media', () => {
    expect(mediaDir({ MEDIA_DIR: '/srv/media' })).toBe('/srv/media');
    expect(mediaDir({})).toMatch(/apps\/server\/media$/);
    expect(() => mediaDir({ MEDIA_DIR: 'media' })).toThrow(/absolute/);
  });
});
