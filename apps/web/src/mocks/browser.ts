import { setupWorker } from 'msw/browser';

import { API_URL } from '../api/config.ts';
import { parseMockControls } from './controls.ts';
import { createMockDb, sessionMockDbStorage } from './db.ts';
import { createHandlers } from './handlers.ts';

/** sessionStorage key of the mock backend state (users changed by `PATCH /me`). */
const DB_STORAGE_KEY = 'tma80:mock-db';

/**
 * Starts MSW in the browser (`VITE_API=mock`). Only API requests are expected to be handled.
 * Changes made through the mock API survive reloads in the same tab; `?mock_reset=1` forgets them.
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
  const worker = setupWorker(...createHandlers(apiBase, parseMockControls(search), db));
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      if (request.url.startsWith(apiBase)) print.warning();
    },
  });
}
