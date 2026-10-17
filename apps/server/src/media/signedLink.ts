import { createHash } from 'node:crypto';

/** Lifetime of a signed link to a private photo (ТЗ, «Фото»: 1 hour). */
export const SIGNED_LINK_TTL_SECONDS = 60 * 60;

/**
 * The `md5` argument of an nginx `secure_link` link: MD5 of `"$secure_link_expires$uri <key>"`
 * in base64url without padding (nginx.org, ngx_http_secure_link_module; the same string is in
 * `secure_link_md5` of `deploy/nginx/media.conf.template`).
 * @param uri - the request path nginx sees in `$uri`, e.g. `/media/cooks/<user>/<uuid>.jpg`.
 */
export function secureLinkHash(uri: string, expires: number, key: string): string {
  return createHash('md5')
    .update(`${String(expires)}${uri} ${key}`)
    .digest('base64url');
}

/** Path part of `MEDIA_URL`: `/media` for both `/media` and `https://example.com/media`. */
export function mediaPathPrefix(mediaUrl: string): string {
  const path = /^https?:\/\//.test(mediaUrl) ? new URL(mediaUrl).pathname : mediaUrl;
  return path.replace(/\/+$/, '');
}

/**
 * A link to a private photo for an hour: `${MEDIA_URL}/cooks/<path>?md5=…&expires=…`.
 * @param photoPath - `cooks.photo_path`, `{user_id}/{uuid}.jpg`.
 */
export function signCookPhotoUrl(
  mediaUrl: string,
  photoPath: string,
  key: string,
  now: Date,
): string {
  const expires = Math.floor(now.getTime() / 1000) + SIGNED_LINK_TTL_SECONDS;
  const relative = `/cooks/${photoPath}`;
  const md5 = secureLinkHash(`${mediaPathPrefix(mediaUrl)}${relative}`, expires, key);
  return `${mediaUrl}${relative}?md5=${md5}&expires=${String(expires)}`;
}
