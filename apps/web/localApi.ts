import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * Dev-only `VITE_API=local`: the app talks to the local Node server through the dev server.
 *
 * - `/api/*` is proxied to the server. The mock Telegram environment (`VITE_TG_MOCK=1`) sends
 *   initData with a placeholder hash; the proxy re-signs it here, in Node, with `BOT_TOKEN` from
 *   `.env` (the same algorithm as the server, core.telegram.org «Validating data received via the
 *   Mini App»), so the token never reaches the browser or a build.
 * - `/media/content/*` serves the content photos from `content/`, `/media/share/*` the share cards
 *   and `/media/cooks/*` the private cook photos from `MEDIA_DIR` only by a signed link, as nginx
 *   `secure_link` does in production (`deploy/nginx/templates/media.conf.template`).
 */

/** Signs init data fields with the bot token the way Telegram does; returns the raw string. */
export function signInitData(fields: Readonly<Record<string, string>>, botToken: string): string {
  const entries = Object.entries(fields).filter(([key]) => key !== 'hash');
  const checkString = entries
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams([...entries, ['hash', hash]]).toString();
}

const AUTH_PREFIX = 'tma ';

/**
 * `Authorization: tma <initData>` of the mock Telegram client re-signed with the test token and a
 * fresh `auth_date`; the placeholder `hash` and `signature` are dropped. `undefined` if the header
 * is not init data.
 */
export function resignAuthorization(
  header: string | undefined,
  botToken: string,
  now = new Date(),
): string | undefined {
  if (header?.startsWith(AUTH_PREFIX) !== true) return undefined;
  const fields = Object.fromEntries(
    [...new URLSearchParams(header.slice(AUTH_PREFIX.length))].filter(
      ([key]) => key !== 'hash' && key !== 'signature',
    ),
  );
  fields.auth_date = String(Math.floor(now.getTime() / 1000));
  return `${AUTH_PREFIX}${signInitData(fields, botToken)}`;
}

export type SecureLinkStatus = 'ok' | 'invalid' | 'expired';

/**
 * What nginx `secure_link` decides about a request (`$secure_link`: `1`, empty, `0`): MD5 of
 * `"$secure_link_expires$uri <key>"` in base64url, as the server signs it
 * (`apps/server/src/media/signedLink.ts`); the link is valid until `expires` inclusive.
 */
export function checkSecureLink(
  uri: string,
  md5: string | null,
  expires: string | null,
  key: string,
  now = new Date(),
): SecureLinkStatus {
  if (md5 === null || expires === null || !/^\d{1,12}$/.test(expires)) return 'invalid';
  const expected = Buffer.from(
    createHash('md5').update(`${expires}${uri} ${key}`).digest('base64url'),
  );
  const given = Buffer.from(md5);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'invalid';
  return Number(expires) < Math.floor(now.getTime() / 1000) ? 'expired' : 'ok';
}

/** A content photo path: `<country>/<slug>.webp`. */
const CONTENT_PHOTO_RE = /^\/([a-z]{2,3})\/([a-z0-9-]+)\.webp$/;

export interface LocalApiOptions {
  /** URL of the local Node server, e.g. `http://127.0.0.1:3080`. */
  target: string;
  botToken: string;
  /** Absolute path of `content/`. */
  contentDir: string;
  /** `MEDIA_DIR` of the server: uploaded files with `cooks/` and `share/` inside. */
  mediaDir: string;
  /** `MEDIA_SIGNING_KEY` of the server: checks the links to private photos. */
  mediaSigningKey: string;
}

/** A cook photo `/<user>/<uuid>.jpg` and a share card `/<uuid>.jpg` (names the server gives). */
const COOK_PHOTO_RE = /^\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.jpg$/;
const SHARE_CARD_RE = /^\/([0-9a-f-]{36})\.jpg$/;

const sendFile = (res: ServerResponse, file: string | null, type: string, cache: string) => {
  if (file === null || !existsSync(file)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  createReadStream(file).pipe(res);
};

export function localApi({
  target,
  botToken,
  contentDir,
  mediaDir,
  mediaSigningKey,
}: LocalApiOptions): Plugin {
  return {
    name: 'tma80:local-api',
    apply: 'serve',
    config: () => ({
      server: {
        proxy: {
          '/api': {
            target,
            configure(proxy) {
              proxy.on('proxyReq', (proxyReq, req) => {
                const signed = resignAuthorization(req.headers.authorization, botToken);
                if (signed !== undefined) proxyReq.setHeader('authorization', signed);
              });
            },
          },
        },
      },
    }),
    configureServer(server) {
      server.middlewares.use('/media/content', (req, res) => {
        const match = CONTENT_PHOTO_RE.exec((req.url ?? '').split('?')[0] ?? '');
        const file = match && resolve(contentDir, match[1] ?? '', `${match[2] ?? ''}.webp`);
        if (!file || !existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'image/webp');
        createReadStream(file).pipe(res);
      });
      server.middlewares.use('/media/share', (req, res) => {
        const match = SHARE_CARD_RE.exec((req.url ?? '').split('?')[0] ?? '');
        const file = match && resolve(mediaDir, 'share', `${match[1] ?? ''}.jpg`);
        sendFile(res, file, 'image/jpeg', 'public, max-age=86400');
      });
      server.middlewares.use('/media/cooks', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const status = checkSecureLink(
          `/media/cooks${url.pathname}`,
          url.searchParams.get('md5'),
          url.searchParams.get('expires'),
          mediaSigningKey,
        );
        if (status !== 'ok') {
          res.statusCode = status === 'expired' ? 410 : 403;
          res.end();
          return;
        }
        const match = COOK_PHOTO_RE.exec(url.pathname);
        const file = match && resolve(mediaDir, 'cooks', match[1] ?? '', `${match[2] ?? ''}.jpg`);
        sendFile(res, file, 'image/jpeg', 'private, max-age=3600');
      });
    },
  };
}
