import { emitEvent } from '@tma.js/sdk-react';

/** How the user closes the mock dialog sharing a prepared message (`?mock_share=`). */
export const MOCK_SHARE_OUTCOMES = ['sent', 'failed'] as const;
export type MockShareOutcome = (typeof MOCK_SHARE_OUTCOMES)[number];

/** The outcome from `?mock_share=`; `sent` by default or for an unknown value. */
export function parseMockShareOutcome(search: string): MockShareOutcome {
  const value = new URLSearchParams(search).get('mock_share');
  if (value === null) return 'sent';
  const outcome = MOCK_SHARE_OUTCOMES.find((item) => item === value);
  if (outcome) return outcome;
  console.warn(`[tg mock] unknown mock_share=${value}, using sent`);
  return 'sent';
}

/** How long the mock share dialog stays open, ms. */
const DIALOG_MS = 300;

/**
 * Answers `web_app_send_prepared_message` like Telegram after the user deals with the chat
 * picker: `prepared_message_sent`, or `prepared_message_failed` (the user closed it).
 */
export function answerMockPreparedMessage(outcome: MockShareOutcome): void {
  window.setTimeout(() => {
    if (outcome === 'sent') emitEvent('prepared_message_sent');
    else emitEvent('prepared_message_failed', { error: 'USER_DECLINED' });
  }, DIALOG_MS);
}
