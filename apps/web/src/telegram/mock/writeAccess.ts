import { emitEvent } from '@tma.js/sdk-react';

/**
 * Window event the mock Telegram client sends when the user «allows» the bot to write: the mock
 * backend (`src/mocks/browser.ts`) sets `botCanWrite`, as the bot webhook does on the
 * `write_access_allowed` service message. `detail` — `{ tgId }`.
 */
export const MOCK_WRITE_ACCESS_EVENT = 'tma80:mock-write-access';

export interface MockWriteAccessDetail {
  tgId: number;
}

/** How the user answers the mock «allow the bot to write» popup (`?mock_write_access=`). */
export const MOCK_WRITE_ACCESS_OUTCOMES = ['allowed', 'cancelled'] as const;
export type MockWriteAccessOutcome = (typeof MOCK_WRITE_ACCESS_OUTCOMES)[number];

/** The answer from `?mock_write_access=`; `allowed` by default or for an unknown value. */
export function parseMockWriteAccessOutcome(search: string): MockWriteAccessOutcome {
  const value = new URLSearchParams(search).get('mock_write_access');
  if (value === null) return 'allowed';
  const outcome = MOCK_WRITE_ACCESS_OUTCOMES.find((item) => item === value);
  if (outcome) return outcome;
  console.warn(`[tg mock] unknown mock_write_access=${value}, using allowed`);
  return 'allowed';
}

/** How long the mock permission popup stays open before the answer, ms. */
const POPUP_MS = 300;

/**
 * Answers `web_app_request_write_access` like Telegram after the user deals with the popup:
 * `write_access_requested` with the status. An allowed request is first reported to the mock
 * backend (synchronously), so `botCanWrite` is there when the app asks the server.
 */
export function answerMockWriteAccess(tgId: number, outcome: MockWriteAccessOutcome): void {
  window.setTimeout(() => {
    if (outcome === 'allowed') {
      window.dispatchEvent(
        new CustomEvent<MockWriteAccessDetail>(MOCK_WRITE_ACCESS_EVENT, { detail: { tgId } }),
      );
    }
    emitEvent('write_access_requested', { status: outcome });
  }, POPUP_MS);
}
