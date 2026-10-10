import { backButton } from '@tma.js/sdk-react';
import { useEffect, useState } from 'react';

import { CHROME_COLOR_TOKEN } from '../theme/tokens.ts';
import { setChromeColors } from './sdk.ts';

/** True if this client can show the Telegram BackButton and report presses (Mini Apps 6.1+). */
export function isTelegramBackButtonAvailable(): boolean {
  try {
    return backButton.show.isAvailable() && backButton.onClick.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Shows the Telegram BackButton while `onBack` is set and calls it on press; hides the button on
 * unmount. Pass a stable callback (`useCallback`).
 * @returns `true` if the system button handles «back»; `false` if the client cannot show it (old
 *   client, SDK not mounted, outside Telegram) — then the screen must draw its own back button
 *   (`BackNavigation` does it).
 */
export function useTelegramBackButton(onBack: (() => void) | undefined): boolean {
  // Availability is fixed for the session: it depends on the client version and the SDK mount.
  const [available] = useState(isTelegramBackButtonAvailable);
  useEffect(() => {
    if (!onBack || !available) return;
    const subscription = backButton.onClick.ifAvailable(onBack);
    backButton.show.ifAvailable();
    return () => {
      if (subscription.ok) subscription.data();
      backButton.hide.ifAvailable();
    };
  }, [onBack, available]);
  return available;
}

/**
 * Paints the Telegram header and background with a colour token while the screen is shown
 * (e.g. `--color-ink` on dark screens), and restores the default `--color-bg` afterwards.
 */
export function useTelegramChromeColor(token: string): void {
  useEffect(() => {
    setChromeColors(token);
    return () => {
      setChromeColors(CHROME_COLOR_TOKEN);
    };
  }, [token]);
}
