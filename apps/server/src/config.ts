import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `BOT_TOKEN` from the environment: the bot token lives only in the server environment and `.env`
 * (never in git or the client bundle). Init data is checked with it.
 */
export function botToken(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const token = env.BOT_TOKEN;
  if (token === undefined || token.trim() === '') {
    throw new Error(
      'BOT_TOKEN is not set: put the bot token (a test bot locally) into .env or the environment',
    );
  }
  return token.trim();
}

/**
 * `MEDIA_URL`: public base URL of media files (nginx serves `/media/content/*` photos of the
 * content); `/media` on our own domain by default. A trailing slash is dropped.
 */
export function mediaUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const url = env.MEDIA_URL?.trim();
  return (url === undefined || url === '' ? '/media' : url).replace(/\/+$/, '');
}

/** Minimal length of `MEDIA_SIGNING_KEY`: it must not be guessable (e.g. `openssl rand -hex 32`). */
const SIGNING_KEY_MIN_LENGTH = 32;

/**
 * `MEDIA_SIGNING_KEY`: the secret of the signed links to private cook photos (nginx `secure_link`,
 * decision 0019). The same key goes into the nginx config; it never reaches the client or the logs.
 */
export function mediaSigningKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const key = env.MEDIA_SIGNING_KEY?.trim() ?? '';
  if (key === '') {
    throw new Error(
      'MEDIA_SIGNING_KEY is not set: put a random secret (openssl rand -hex 32) into .env or the environment',
    );
  }
  // nginx puts the key into `secure_link_md5` as is: whitespace and quotes would break it.
  if (key.length < SIGNING_KEY_MIN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error(
      `MEDIA_SIGNING_KEY must be at least ${String(SIGNING_KEY_MIN_LENGTH)} characters of [A-Za-z0-9_-]`,
    );
  }
  return key;
}

/**
 * `MEDIA_DIR`: the folder of uploaded files with `cooks/` (private) and `share/` (public) inside.
 * An absolute path; `apps/server/media` (ignored by git) by default for local development.
 */
export function mediaDir(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const dir = env.MEDIA_DIR?.trim() ?? '';
  if (dir === '') return fileURLToPath(new URL('../media', import.meta.url));
  if (!isAbsolute(dir)) throw new Error('MEDIA_DIR must be an absolute path');
  return dir;
}

type Env = Readonly<Record<string, string | undefined>>;

const optional = (env: Env, name: string): string | null => {
  const value = env[name]?.trim() ?? '';
  return value === '' ? null : value;
};

/** An optional absolute URL from the environment; `https:` only when `httpsOnly`. */
const optionalUrl = (env: Env, name: string, httpsOnly: boolean): string | null => {
  const value = optional(env, name);
  if (value === null) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' && (httpsOnly || url.protocol !== 'http:')) {
    throw new Error(`${name} must be an ${httpsOnly ? 'https' : 'http(s)'} URL`);
  }
  return value;
};

/**
 * `WEBAPP_URL`: the HTTPS address of the mini app for the bot's web_app buttons (`/start` and the
 * chat menu). `null` when unset: the server then runs without the bot webhook (local development).
 */
export function webAppUrl(env: Env = process.env): string | null {
  return optionalUrl(env, 'WEBAPP_URL', true);
}

/**
 * `PUBLIC_URL`: the HTTPS origin of our domain; `npm run bot:setup` points the webhook to
 * `${PUBLIC_URL}/api/bot/webhook`. A trailing slash is dropped.
 */
export function publicUrl(env: Env = process.env): string {
  const url = optionalUrl(env, 'PUBLIC_URL', true);
  if (url === null) throw new Error('PUBLIC_URL is not set: the https origin of the server');
  return url.replace(/\/+$/, '');
}

/** Pages of the documents for `/terms` (`TERMS_URL`, `PRIVACY_URL`); `null` until published. */
export function documentLinks(env: Env = process.env): {
  termsUrl: string | null;
  privacyUrl: string | null;
} {
  return {
    termsUrl: optionalUrl(env, 'TERMS_URL', false),
    privacyUrl: optionalUrl(env, 'PRIVACY_URL', false),
  };
}

/** `SUPPORT_CONTACT` for `/paysupport` (@username or e-mail); `null` until it is known. */
export function supportContact(env: Env = process.env): string | null {
  return optional(env, 'SUPPORT_CONTACT');
}

/**
 * `MINI_APP_LINK`: the direct link of the mini app `https://t.me/<bot>/<app>` (no query). The
 * share message of a stamp carries it with the user's invite code (`startapp`); without it
 * `POST /api/share/stamp/:cookId` answers `503 unavailable` and the client falls back to
 * `t.me/share/url` (decision 0022).
 */
export function miniAppLink(env: Env = process.env): string | null {
  const value = optionalUrl(env, 'MINI_APP_LINK', true);
  if (value === null) return null;
  const url = new URL(value);
  if (url.hostname !== 't.me' || !/^\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/?$/.test(url.pathname) || url.search !== '') {
    throw new Error('MINI_APP_LINK must look like https://t.me/<bot>/<app>');
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}

/**
 * `TRUST_PROXY`: addresses of the reverse proxies whose `X-Forwarded-For` the server trusts
 * (Fastify `trustProxy`, the syntax of proxy-addr: IPs, CIDRs and the presets `loopback`,
 * `linklocal`, `uniquelocal`, comma-separated). In production compose it is `uniquelocal`: only
 * nginx reaches the server over the Docker network, so `request.ip` and the logs show the client
 * address (decision 0025). Unset — `false`, the proxy headers are ignored. A hop count is not
 * accepted: Fastify then trusts nobody.
 */
export function trustProxy(env: Env = process.env): string | false {
  const value = optional(env, 'TRUST_PROXY');
  if (value === null) return false;
  if (!/^[\w.:/]+(\s*,\s*[\w.:/]+)*$/.test(value) || /^\d+$/.test(value)) {
    throw new Error('TRUST_PROXY must list proxy addresses, CIDRs or presets (e.g. uniquelocal)');
  }
  return value;
}
