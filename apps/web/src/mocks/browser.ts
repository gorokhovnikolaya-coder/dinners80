import { HttpResponse, http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

import { API_URL } from '../api/config.ts';
import { MOCK_PAYMENT_EVENT, type MockPaymentDetail } from '../telegram/mock/invoice.ts';
import {
  MOCK_WRITE_ACCESS_EVENT,
  type MockWriteAccessDetail,
} from '../telegram/mock/writeAccess.ts';
import { parseMockControls, takeFailure } from './controls.ts';
import { createMockDb, sessionMockDbStorage, type MockEvent } from './db.ts';
import { createHandlers } from './handlers.ts';

/** The window with the analytics events of the mock backend (e2e reads them). */
export type MockEventsWindow = Window & { tma80MockEvents?: () => readonly MockEvent[] };

/** sessionStorage key of the mock backend state (users changed by `PATCH /me`). */
const DB_STORAGE_KEY = 'tma80:mock-db';

/**
 * Starts MSW in the browser (`VITE_API=mock`). Only API requests are expected to be handled.
 * Changes made through the mock API survive reloads in the same tab; `?mock_reset=1` forgets them.
 * Invoices «paid» by the mock Telegram client (`MOCK_PAYMENT_EVENT`) become subscriptions; a
 * write access it «allowed» (`MOCK_WRITE_ACCESS_EVENT`) sets `botCanWrite`.
 */
export async function startMockApi(): Promise<void> {
  const apiBase = new URL(API_URL, window.location.origin).href.replace(/\/$/, '');
  const search = window.location.search;
  if (new URLSearchParams(search).has('mock_reset')) {
    try {
      sessionStorage.removeItem(DB_STORAGE_KEY);
    } catch {
      // Nothing stored if storage is unavailable.
    }
  }
  const db = createMockDb(sessionMockDbStorage(DB_STORAGE_KEY));
  // The mock Telegram client «paid» an invoice: record the subscription like the bot webhook.
  window.addEventListener(MOCK_PAYMENT_EVENT, (event) => {
    const { slug } = (event as CustomEvent<MockPaymentDetail>).detail;
    db.completePayment(slug);
  });
  // The user let the bot write: the webhook's `write_access_allowed` sets `bot_can_write`.
  window.addEventListener(MOCK_WRITE_ACCESS_EVENT, (event) => {
    db.allowWriteAccess((event as CustomEvent<MockWriteAccessDetail>).detail.tgId);
  });
  // The `events` table of the mock backend, for e2e checks: `window.tma80MockEvents()`.
  (window as MockEventsWindow).tma80MockEvents = db.listEvents;
  const controls = parseMockControls(search);
  const worker = setupWorker(
    ...createHandlers(apiBase, controls, db),
    // `?mock_error=chunk`: the first lazy screen chunk (Vite serves `/src/screens/**` in dev)
    // fails with a network error, to check the screen error boundary.
    http.get(/\/src\/screens\/.+\.tsx/, () =>
      takeFailure(controls, 'chunk') ? HttpResponse.error() : passthrough(),
    ),
  );
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      if (request.url.startsWith(apiBase)) print.warning();
    },
  });
}
