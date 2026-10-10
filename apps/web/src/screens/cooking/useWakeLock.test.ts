// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWakeLock } from './useWakeLock.ts';

class FakeSentinel extends EventTarget {
  released = false;
  release = vi.fn(() => {
    this.released = true;
    this.dispatchEvent(new Event('release'));
    return Promise.resolve();
  });
}

const stubWakeLock = (request: () => Promise<FakeSentinel>) => {
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
};

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock', () => {
  it('is off where the API is missing', () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current).toBe(false);
  });

  it('holds the lock while mounted, takes it again after the page is shown, releases on unmount', async () => {
    const sentinels: FakeSentinel[] = [];
    const request = vi.fn(() => {
      const sentinel = new FakeSentinel();
      sentinels.push(sentinel);
      return Promise.resolve(sentinel);
    });
    stubWakeLock(request);

    const { result, unmount } = renderHook(() => useWakeLock());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    // The browser releases the lock when the page is hidden.
    act(() => {
      void sentinels[0]?.release();
    });
    expect(result.current).toBe(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(request).toHaveBeenCalledTimes(2);

    unmount();
    expect(sentinels[1]?.release).toHaveBeenCalled();
  });

  it('stays off when the request is refused', async () => {
    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    stubWakeLock(request);
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => {
      expect(request).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });
});
