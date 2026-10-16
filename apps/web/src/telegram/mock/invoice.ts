import { emitEvent } from '@tma.js/sdk-react';

/**
 * Window event the mock Telegram client sends when it «pays» an invoice: the mock backend
 * (`src/mocks/browser.ts`) records the subscription, as the bot webhook does on
 * `successful_payment`. `detail` — `{ slug }`.
 */
export const MOCK_PAYMENT_EVENT = 'tma80:mock-payment';

export interface MockPaymentDetail {
  slug: string;
}

/**
 * How the mock client closes an opened invoice (`?mock_invoice=`): with a Telegram status, or
 * `unconfirmed` — `paid`, but the server never hears about the payment (the webhook is late).
 */
export const MOCK_INVOICE_OUTCOMES = [
  'paid',
  'cancelled',
  'failed',
  'pending',
  'unconfirmed',
] as const;
export type MockInvoiceOutcome = (typeof MOCK_INVOICE_OUTCOMES)[number];

/** The invoice outcome from `?mock_invoice=`; `paid` by default or for an unknown value. */
export function parseMockInvoiceOutcome(search: string): MockInvoiceOutcome {
  const value = new URLSearchParams(search).get('mock_invoice');
  if (value === null) return 'paid';
  const outcome = MOCK_INVOICE_OUTCOMES.find((item) => item === value);
  if (outcome) return outcome;
  console.warn(`[tg mock] unknown mock_invoice=${value}, using paid`);
  return 'paid';
}

/** How long the mock «payment sheet» stays open before closing, ms. */
const INVOICE_SHEET_MS = 300;

/**
 * Answers `web_app_open_invoice` like Telegram after the user deals with the payment sheet:
 * `invoice_closed` with the status. A `paid` invoice is first reported to the mock backend
 * (synchronously), so the subscription is there when the app asks the server.
 */
export function closeMockInvoice(slug: string, outcome: MockInvoiceOutcome): void {
  window.setTimeout(() => {
    if (outcome === 'paid') {
      window.dispatchEvent(
        new CustomEvent<MockPaymentDetail>(MOCK_PAYMENT_EVENT, { detail: { slug } }),
      );
    }
    emitEvent('invoice_closed', { slug, status: outcome === 'unconfirmed' ? 'paid' : outcome });
  }, INVOICE_SHEET_MS);
}
