import type { MapResponse } from '@tma80/shared';

/** A tile of the paywall mini-map: a published country, filled if passed. */
export interface MiniMapTile {
  id: string;
  passed: boolean;
}

/** Tiles of the mini-map: all published countries in the order of the passport. */
export function miniMapTiles(map: MapResponse): MiniMapTile[] {
  return map.continents.flatMap((group) =>
    group.countries.map((country) => ({ id: country.id, passed: country.passed })),
  );
}

/** Published dishes of all countries — the «90 проверенных рецептов». */
export function publishedDishesCount(map: MapResponse): number {
  return map.continents.reduce(
    (sum, group) =>
      sum + group.countries.reduce((count, country) => count + country.dishes.length, 0),
    0,
  );
}

/**
 * After `paid` the server learns about the payment from the bot webhook, which may come a moment
 * later: the paywall asks for the subscription this many times, this often (≈ 15 s in all).
 */
export const CONFIRM_ATTEMPTS = 10;
export const CONFIRM_INTERVAL_MS = 1500;

export interface WaitOptions {
  attempts: number;
  intervalMs: number;
  /** Stops waiting (the screen is closed). */
  cancelled?: () => boolean;
  /** Pause between attempts; `setTimeout` by default (replaced in tests). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Asks `check` until the subscription is active: right away, then every `intervalMs`, at most
 * `attempts` times. Counts attempts rather than time, so a frozen clock cannot loop it forever.
 * A failed check counts as «not yet».
 * @returns `true` once `check` says active; `false` after the last attempt or when cancelled.
 */
export async function waitForSubscription(
  check: () => Promise<boolean>,
  { attempts, intervalMs, cancelled = () => false, sleep = defaultSleep }: WaitOptions,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    if (cancelled()) return false;
    let active = false;
    try {
      active = await check();
    } catch {
      active = false;
    }
    if (active) return true;
  }
  return false;
}
