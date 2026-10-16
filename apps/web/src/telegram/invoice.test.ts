// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openInvoice } from './invoice.ts';
import { parseMockInvoiceOutcome } from './mock/invoice.ts';

const sdk = vi.hoisted(() => {
  const state = { invoiceAvailable: true, linkAvailable: true, status: 'paid' as string };
  const openUrl = Object.assign(
    vi.fn(() => Promise.resolve(state.status)),
    { isAvailable: () => state.invoiceAvailable },
  );
  const openTelegramLink = Object.assign(vi.fn(), {
    ifAvailable: vi.fn(() => ({ ok: state.linkAvailable })),
  });
  return { state, invoice: { openUrl }, openTelegramLink };
});

vi.mock('@tma.js/sdk-react', () => ({
  invoice: sdk.invoice,
  openTelegramLink: sdk.openTelegramLink,
  emitEvent: vi.fn(),
}));

const LINK = 'https://t.me/$abc';

beforeEach(() => {
  sdk.state.invoiceAvailable = true;
  sdk.state.linkAvailable = true;
  sdk.state.status = 'paid';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openInvoice', () => {
  it('opens the invoice and returns the Telegram status', async () => {
    for (const status of ['paid', 'cancelled', 'failed', 'pending']) {
      sdk.state.status = status;
      await expect(openInvoice(LINK)).resolves.toBe(status);
    }
    expect(sdk.invoice.openUrl).toHaveBeenCalledWith(LINK);
  });

  it('treats an unknown status as pending', async () => {
    sdk.state.status = 'refunded';
    await expect(openInvoice(LINK)).resolves.toBe('pending');
  });

  it('falls back to a Telegram link in a client without invoices', async () => {
    sdk.state.invoiceAvailable = false;
    await expect(openInvoice(LINK)).resolves.toBe('external');
    expect(sdk.openTelegramLink.ifAvailable).toHaveBeenCalledWith(LINK);
    expect(sdk.invoice.openUrl).not.toHaveBeenCalled();
  });

  it('opens a new tab outside Telegram', async () => {
    sdk.state.invoiceAvailable = false;
    sdk.state.linkAvailable = false;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(openInvoice(LINK)).resolves.toBe('external');
    expect(open).toHaveBeenCalledWith(LINK, '_blank', 'noopener');
  });
});

describe('parseMockInvoiceOutcome', () => {
  it('reads ?mock_invoice=, paid by default or for an unknown value', () => {
    expect(parseMockInvoiceOutcome('')).toBe('paid');
    expect(parseMockInvoiceOutcome('?mock_invoice=failed')).toBe('failed');
    expect(parseMockInvoiceOutcome('?user=1003&mock_invoice=unconfirmed')).toBe('unconfirmed');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseMockInvoiceOutcome('?mock_invoice=maybe')).toBe('paid');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
