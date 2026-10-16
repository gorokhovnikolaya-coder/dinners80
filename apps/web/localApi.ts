import { createHmac } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * Dev-only `VITE_API=local`: the app talks to the local Node server through the dev server.
 *
 * - `/api/*` is proxied to the server. The mock Telegram environment (`VITE_TG_MOCK=1`) sends
 *   initData with a placeholder hash; the proxy re-signs it here, in Node, with `BOT_TOKEN` from
 *   `.env` (the same algorithm as the server, core.telegram.org «Validating data received via the
 *   Mini App»), so the token never reaches the browser or a build.
 * - `/media/content/*` serves the content photos from `content/` (nginx does it in production).
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

/** A content photo path: `<country>/<slug>.webp`. */
const CONTENT_PHOTO_RE = /^\/([a-z]{2,3})\/([a-z0-9-]+)\.webp$/;

export interface LocalApiOptions {
  /** URL of the local Node server, e.g. `http://127.0.0.1:3080`. */
  target: string;
  botToken: string;
  /** Absolute path of `content/`. */
  contentDir: string;
}

export function localApi({ target, botToken, contentDir }: LocalApiOptions): Plugin {
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
    },
  };
}
