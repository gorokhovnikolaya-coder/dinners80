import { HttpResponse, http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

import { API_URL } from '../api/config.ts';
import { parseMockControls, takeFailure } from './controls.ts';
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
