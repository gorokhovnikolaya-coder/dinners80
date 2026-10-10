import { test as base, expect, type Page } from '@playwright/test';

/**
 * Chromium aborts in-flight requests with this error when the host's network configuration
 * changes (NetworkChangeNotifier flushes the socket pools), even for requests to localhost.
 * On a developer machine it happens every few seconds while some Docker container restarts in a
 * loop (each restart adds and removes a veth interface) or a VPN reconnects.
 */
const NETWORK_CHANGED = 'net::ERR_NETWORK_CHANGED';
/** Attempts of one `page.goto` when the page load was hit by a network change. */
const GOTO_ATTEMPTS = 3;

/**
 * `test` with a `page` that survives host network changes during navigation.
 *
 * The Vite dev server serves the app as ~60 separate ES modules. If Chromium aborts any of them
 * with `ERR_NETWORK_CHANGED`, the static import graph fails, the app never mounts and the test
 * times out on a blank page — a failure of the test machine, not of the app. So `page.goto`
 * repeats the navigation if a request failed with exactly this error before the page `load`
 * event (module scripts delay it, so the whole entry graph is covered). Other failures are not
 * retried. Each repeat is recorded as a test annotation, and a failed test that saw such an
 * error mid-test (after `load`) gets an annotation pointing at the cause.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    let networkChanges = 0;
    page.on('requestfailed', (request) => {
      if (request.failure()?.errorText === NETWORK_CHANGED) networkChanges += 1;
    });

    const goto = page.goto.bind(page);
    page.goto = async (...args: Parameters<Page['goto']>) => {
      for (let attempt = 1; ; attempt += 1) {
        const before = networkChanges;
        const response = await goto(...args);
        if (networkChanges === before || attempt === GOTO_ATTEMPTS) return response;
        testInfo.annotations.push({
          type: 'network-changed',
          description: `${NETWORK_CHANGED} while loading ${args[0]}, navigation repeated`,
        });
      }
    };

    await use(page);

    if (testInfo.status !== testInfo.expectedStatus && networkChanges > 0) {
      testInfo.annotations.push({
        type: 'network-changed',
        description: `${String(networkChanges)} request(s) failed with ${NETWORK_CHANGED}: the host network changed during the test`,
      });
    }
  },
});

export { expect };
