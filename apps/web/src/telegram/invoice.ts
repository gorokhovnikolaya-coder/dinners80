import { invoice, openTelegramLink } from '@tma.js/sdk-react';

/**
 * How an invoice ended for the app: a Telegram status (`paid`, `cancelled`, `failed`, `pending`)
 * or `external` — the client cannot open invoices inside the mini app (Mini Apps < 6.1, outside
 * Telegram), so the link was opened as a regular Telegram link and the status is unknown.
 */
export type InvoiceOutcome = 'paid' | 'cancelled' | 'failed' | 'pending' | 'external';

const KNOWN_STATUSES = ['paid', 'cancelled', 'failed', 'pending'] as const;

/**
 * Opens the Telegram Stars invoice (`openInvoice`) and waits until the user closes it.
 * An unknown status from a newer client is treated as `pending`: the server decides.
 * @throws if the client fails to open the invoice (e.g. a malformed link).
 */
export async function openInvoice(link: string): Promise<InvoiceOutcome> {
  let available = false;
  try {
    available = invoice.openUrl.isAvailable();
  } catch {
    available = false;
  }
  if (available) {
    const status = await invoice.openUrl(link);
    return KNOWN_STATUSES.find((known) => known === status) ?? 'pending';
  }
  let opened = false;
  try {
    opened = openTelegramLink.ifAvailable(link).ok;
  } catch {
    opened = false;
  }
  if (!opened) window.open(link, '_blank', 'noopener');
  return 'external';
}
