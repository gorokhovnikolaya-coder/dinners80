import {
  APP_OPEN_PARAM,
  AUTH_SCHEME,
  EVENTS_BATCH_MAX,
  appOpenSource,
  type ClientEvent,
  type EventsRequest,
} from '@tma80/shared';

import { getRawInitData } from '../telegram/sdk.ts';
import { API_URL } from './config.ts';

/**
 * Analytics events (ТЗ, «Аналитика»; decision 0024): `track` puts an event in the queue, the
 * queue goes to `POST /events` in batches — a few seconds after the first event, at once when a
 * batch is full and when the page is hidden (`fetch` with `keepalive`: `sendBeacon` cannot send
 * the initData header). Analytics never breaks a screen: a failed batch is retried with the next
 * one, a rejected one (4xx) is dropped, and the queue is capped.
 */

/** Delay of a batch after its first event. */
export const FLUSH_DELAY_MS = 3000;
/** Most events waiting in the queue: the oldest go first when the server is unreachable. */
export const QUEUE_MAX = 200;

let queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;

function schedule(): void {
  if (timer !== undefined || queue.length === 0) return;
  timer = setTimeout(() => {
    timer = undefined;
    void flushEvents();
  }, FLUSH_DELAY_MS);
}

/** Queues an analytics event; the batch is sent later (`flushEvents`). */
export function track(event: ClientEvent): void {
  queue.push(event);
  if (queue.length > QUEUE_MAX) queue = queue.slice(queue.length - QUEUE_MAX);
  if (queue.length >= EVENTS_BATCH_MAX) void flushEvents();
  // While a batch is in flight the flush above is skipped: the timer sends the rest.
  schedule();
}

/** Sends the queued events now, in batches of at most `EVENTS_BATCH_MAX`. */
export async function flushEvents(): Promise<void> {
  if (sending) return;
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  sending = true;
  try {
    while (queue.length > 0) {
      const batch = queue.slice(0, EVENTS_BATCH_MAX);
      const sent = await send(batch);
      if (sent === 'retry') break;
      queue = queue.slice(batch.length);
    }
  } finally {
    sending = false;
  }
  // A batch that failed waits for the next event (or the next hiding of the page).
}

/** `sent` — stored or rejected for good (4xx); `retry` — the network or the server failed. */
async function send(events: ClientEvent[]): Promise<'sent' | 'retry'> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const initData = getRawInitData();
  if (initData) headers.Authorization = `${AUTH_SCHEME} ${initData}`;
  const body: EventsRequest = { events };
  try {
    const response = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
    return response.ok || (response.status >= 400 && response.status < 500) ? 'sent' : 'retry';
  } catch {
    return 'retry';
  }
}

/** The launch label `?from=` of the page at startup, before the router changes the URL. */
const launchLabel =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(APP_OPEN_PARAM);

const APP_OPEN_KEY = 'tma80:app_open';

/**
 * `app_open` once per launch (decision 0024): after the first successful `POST /auth`, not again
 * when the page is reloaded in the same webview (sessionStorage).
 */
export function trackAppOpen(): void {
  try {
    if (sessionStorage.getItem(APP_OPEN_KEY) !== null) return;
    sessionStorage.setItem(APP_OPEN_KEY, '1');
  } catch {
    // No storage: an event per page load is the best we can do.
  }
  const startParam = new URLSearchParams(getRawInitData() ?? '').get('start_param');
  track({ name: 'app_open', props: { source: appOpenSource(startParam, launchLabel) } });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushEvents();
  });
  window.addEventListener('pagehide', () => void flushEvents());
}

/** Test helper: empties the queue and the timer. */
export function resetEventsForTest(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  queue = [];
  sending = false;
}
