import { describe, expect, it } from 'vitest';

import {
  SIGNED_LINK_TTL_SECONDS,
  mediaPathPrefix,
  secureLinkHash,
  signCookPhotoUrl,
} from './signedLink.ts';

const KEY = 'test-media-key-0123456789abcdefghijklmnop';
const PHOTO = '00000000-0000-4000-8000-000000001002/0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg';

describe('secureLinkHash', () => {
  it('matches the example of the nginx documentation', () => {
    // nginx.org, ngx_http_secure_link_module: `echo -n '2147483647/s/link127.0.0.1 secret' | …`
    expect(secureLinkHash('/s/link127.0.0.1', 2147483647, 'secret')).toBe('_e4Nc3iduzkWRm01TBBNYw');
  });
});

describe('mediaPathPrefix', () => {
  it('takes the path of MEDIA_URL', () => {
    expect(mediaPathPrefix('/media')).toBe('/media');
    expect(mediaPathPrefix('https://example.com/media/')).toBe('/media');
    expect(mediaPathPrefix('https://cdn.example.com')).toBe('');
  });
});

describe('signCookPhotoUrl', () => {
  const now = new Date('2026-10-17T10:00:00Z');
  const expires = Math.floor(now.getTime() / 1000) + SIGNED_LINK_TTL_SECONDS;

  it('signs the path nginx sees for an hour', () => {
    const url = signCookPhotoUrl('/media', PHOTO, KEY, now);
    const md5 = secureLinkHash(`/media/cooks/${PHOTO}`, expires, KEY);
    expect(url).toBe(`/media/cooks/${PHOTO}?md5=${md5}&expires=${String(expires)}`);
  });

  it('keeps an absolute MEDIA_URL and signs only its path', () => {
    const url = new URL(signCookPhotoUrl('https://example.com/media', PHOTO, KEY, now));
    expect(url.origin + url.pathname).toBe(`https://example.com/media/cooks/${PHOTO}`);
    expect(url.searchParams.get('md5')).toBe(secureLinkHash(`/media/cooks/${PHOTO}`, expires, KEY));
  });
});
