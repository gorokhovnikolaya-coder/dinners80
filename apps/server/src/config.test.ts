import { describe, expect, it } from 'vitest';

import {
  botToken,
  documentLinks,
  mediaDir,
  mediaSigningKey,
  publicUrl,
  supportContact,
  webAppUrl,
} from './config.ts';

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

describe('bot settings', () => {
  it('takes an https WEBAPP_URL or nothing', () => {
    expect(webAppUrl({})).toBeNull();
    expect(webAppUrl({ WEBAPP_URL: ' https://example.com/app ' })).toBe('https://example.com/app');
    expect(() => webAppUrl({ WEBAPP_URL: 'http://example.com' })).toThrow(/https/);
    expect(() => webAppUrl({ WEBAPP_URL: 'example.com' })).toThrow(/absolute URL/);
  });

  it('requires an https PUBLIC_URL without a trailing slash', () => {
    expect(publicUrl({ PUBLIC_URL: 'https://example.com/' })).toBe('https://example.com');
    expect(() => publicUrl({})).toThrow(/PUBLIC_URL is not set/);
    expect(() => publicUrl({ PUBLIC_URL: 'http://example.com' })).toThrow(/https/);
  });

  it('takes optional document links and the support contact', () => {
    expect(documentLinks({})).toEqual({ termsUrl: null, privacyUrl: null });
    expect(documentLinks({ TERMS_URL: 'https://telegra.ph/terms', PRIVACY_URL: ' ' })).toEqual({
      termsUrl: 'https://telegra.ph/terms',
      privacyUrl: null,
    });
    expect(() => documentLinks({ PRIVACY_URL: 'ftp://x' })).toThrow(/http\(s\)/);
    expect(supportContact({})).toBeNull();
    expect(supportContact({ SUPPORT_CONTACT: ' @help ' })).toBe('@help');
  });
});
