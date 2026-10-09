import { setupWorker } from 'msw/browser';

import { API_URL } from '../api/config.ts';
import { createHandlers } from './handlers.ts';

/** Starts MSW in the browser (`VITE_API=mock`). Only API requests are expected to be handled. */
export async function startMockApi(): Promise<void> {
  const apiBase = new URL(API_URL, window.location.origin).href.replace(/\/$/, '');
  const worker = setupWorker(...createHandlers(apiBase));
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      if (request.url.startsWith(apiBase)) print.warning();
    },
  });
}
