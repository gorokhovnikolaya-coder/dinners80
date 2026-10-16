// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openExternalLink } from './links.ts';
import { parseMockWriteAccessOutcome } from './mock/writeAccess.ts';
import { askWriteAccess, canRequestWriteAccess } from './writeAccess.ts';

const sdk = vi.hoisted(() => {
  const state = {
    writeAccessAvailable: true,
    status: 'allowed' as string,
    reject: false,
    linkOk: true,
    linkThrows: false,
  };
  const requestWriteAccess = Object.assign(
    vi.fn(() =>
      state.reject ? Promise.reject(new Error('timeout')) : Promise.resolve(state.status),
    ),
    { isAvailable: () => state.writeAccessAvailable },
  );
  const openLink = Object.assign(vi.fn(), {
    ifAvailable: vi.fn(() => {
      if (state.linkThrows) throw new Error('not in Telegram');
      return { ok: state.linkOk };
    }),
  });
  return { state, requestWriteAccess, openLink };
});

vi.mock('@tma.js/sdk-react', () => ({
  requestWriteAccess: sdk.requestWriteAccess,
  openLink: sdk.openLink,
  emitEvent: vi.fn(),
}));

beforeEach(() => {
  Object.assign(sdk.state, {
    writeAccessAvailable: true,
    status: 'allowed',
    reject: false,
    linkOk: true,
    linkThrows: false,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('askWriteAccess', () => {
  it('is true only when the user allowed the bot to write', async () => {
    expect(canRequestWriteAccess()).toBe(true);
    await expect(askWriteAccess()).resolves.toBe(true);
    sdk.state.status = 'cancelled';
    await expect(askWriteAccess()).resolves.toBe(false);
    expect(sdk.requestWriteAccess).toHaveBeenCalledTimes(2);
  });

  it('is false if the request fails', async () => {
    sdk.state.reject = true;
    await expect(askWriteAccess()).resolves.toBe(false);
  });

  it('does not ask in a client without the method (Mini Apps < 6.9)', async () => {
    sdk.state.writeAccessAvailable = false;
    expect(canRequestWriteAccess()).toBe(false);
    await expect(askWriteAccess()).resolves.toBe(false);
    expect(sdk.requestWriteAccess).not.toHaveBeenCalled();
  });
});

describe('openExternalLink', () => {
  const URL = 'https://example.com/tma80/terms';

  it('opens the page with Telegram, in Instant View where possible', () => {
    expect(openExternalLink(URL)).toBe(true);
    expect(sdk.openLink.ifAvailable).toHaveBeenCalledWith(URL, { tryInstantView: true });
  });

  it('reports false outside Telegram, so the browser follows the link', () => {
    sdk.state.linkOk = false;
    expect(openExternalLink(URL)).toBe(false);
    sdk.state.linkThrows = true;
    expect(openExternalLink(URL)).toBe(false);
  });
});

describe('parseMockWriteAccessOutcome', () => {
  it('reads ?mock_write_access=, allowed by default or for an unknown value', () => {
    expect(parseMockWriteAccessOutcome('')).toBe('allowed');
    expect(parseMockWriteAccessOutcome('?user=1005&mock_write_access=cancelled')).toBe('cancelled');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseMockWriteAccessOutcome('?mock_write_access=maybe')).toBe('allowed');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
