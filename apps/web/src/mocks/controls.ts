/**
 * Dev switches of the mock API, read from the page URL at MSW start:
 * - `?mock_error=auth` — the first request to the `auth` endpoint fails with HTTP 500
 *   (`{error: {code: 'internal'}}`), the retry succeeds; `auth:always` fails every time.
 *   Several endpoints: `?mock_error=auth,me`. Keys: `auth` (`POST /auth`), `me` (`PATCH /me`), `home` (`GET /home`),
 *   `map` (`GET /map`), `dish` (`GET /dishes/:id`), `shopping` (`POST /shopping`), `upload`
 *   (`POST /uploads/cook-photo`), `cooks` (`POST /cooks`),
 *   `cooks_limit` (`POST /cooks` answers `429 rate_limited` — the daily cook limit),
 *   `chunk` (the first lazy screen chunk, browser only).
 * - `?mock_delay=<ms>` — delay of every mock response, to see loading states.
 */
export interface MockControls {
  /** Endpoint key → remaining failures (`Infinity` — always). */
  failures: Map<string, number>;
  delayMs: number;
}

export const NO_MOCK_CONTROLS: MockControls = { failures: new Map(), delayMs: 0 };

export function parseMockControls(search: string): MockControls {
  const params = new URLSearchParams(search);
  const failures = new Map<string, number>();
  for (const item of (params.get('mock_error') ?? '').split(',')) {
    const [key, mode] = item.trim().split(':');
    if (key) failures.set(key, mode === 'always' ? Infinity : 1);
  }
  const delay = Number(params.get('mock_delay') ?? 0);
  return { failures, delayMs: Number.isFinite(delay) && delay > 0 ? delay : 0 };
}

/** True if this request to `key` must fail; consumes one failure. */
export function takeFailure(controls: MockControls, key: string): boolean {
  const left = controls.failures.get(key) ?? 0;
  if (left <= 0) return false;
  controls.failures.set(key, left - 1);
  return true;
}
