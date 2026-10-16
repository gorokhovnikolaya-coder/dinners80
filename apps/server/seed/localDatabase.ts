import { parse } from 'pg-connection-string';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Why `db:reset` must not touch this database, or `null` if it is local. The host is read with
 * the parser `pg` itself uses (`pg-connection-string`), so `?host=` in the query string counts;
 * `hostaddr` is refused outright, and a URL without a host falls back to `PGHOST` like `pg` does.
 * A Unix socket directory (`/var/run/postgresql`) is local.
 */
export function nonLocalDatabaseReason(
  url: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  let options: ReturnType<typeof parse>;
  try {
    options = parse(url);
  } catch {
    return 'DATABASE_URL is not a valid connection string';
  }
  if (options.hostaddr !== undefined) return 'DATABASE_URL sets hostaddr';
  // pg treats an empty host as missing and takes PGHOST, then localhost.
  const fallback = env.PGHOST === undefined || env.PGHOST === '' ? 'localhost' : env.PGHOST;
  const host = options.host === null || options.host === '' ? fallback : options.host;
  if (host.startsWith('/') || LOCAL_HOSTS.has(host)) return null;
  return `DATABASE_URL points to ${host}`;
}
