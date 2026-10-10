// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BackNavigation } from './BackNavigation.tsx';

const sdk = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { available: true, visible: false, listeners };
  const withChecks = <T extends (...args: never[]) => unknown>(fn: T) =>
    Object.assign(fn, {
      isAvailable: () => state.available,
      ifAvailable: (...args: Parameters<T>) =>
        state.available ? { ok: true as const, data: fn(...args) } : { ok: false as const },
    });
  const backButton = {
    show: withChecks(() => {
      state.visible = true;
    }),
    hide: withChecks(() => {
      state.visible = false;
    }),
    onClick: withChecks((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  return { state, backButton };
});

vi.mock('@tma.js/sdk-react', () => ({ backButton: sdk.backButton }));

beforeEach(() => {
  sdk.state.available = true;
  sdk.state.visible = false;
  sdk.state.listeners.clear();
});

describe('BackNavigation', () => {
  it('uses the Telegram BackButton when the client supports it', () => {
    const onBack = vi.fn();
    const { unmount } = render(<BackNavigation onBack={onBack} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(sdk.state.visible).toBe(true);
    sdk.state.listeners.forEach((listener) => {
      listener();
    });
    expect(onBack).toHaveBeenCalledOnce();

    unmount();
    expect(sdk.state.visible).toBe(false);
    expect(sdk.state.listeners.size).toBe(0);
  });

  it('hides the system button when there is nowhere to go back', () => {
    render(<BackNavigation onBack={undefined} />);
    expect(sdk.state.visible).toBe(false);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws its own 44 × 44 «Назад» button in clients without BackButton', async () => {
    sdk.state.available = false;
    const onBack = vi.fn();
    const { rerender } = render(<BackNavigation onBack={onBack} tone="dark" />);
    const button = screen.getByRole('button', { name: 'Назад' });
    expect(button).toHaveClass('size-11');
    await userEvent.click(button);
    expect(onBack).toHaveBeenCalledOnce();

    rerender(<BackNavigation onBack={undefined} tone="dark" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
