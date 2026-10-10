import { backButton, swipeBehavior } from '@tma.js/sdk-react';
import { useEffect, useState } from 'react';

import { DARK_CHROME_COLOR_TOKEN } from '../theme/tokens.ts';
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
 * Turns off the vertical swipes that close or minimise the mini app while the component is
 * mounted (the cooking mode: wet hands must not close the app) and turns them back on after.
 * Clients without the method (Mini Apps < 7.7) keep the swipes: there is nothing to turn off.
 */
export function useVerticalSwipesDisabled(): void {
  useEffect(() => {
    try {
      swipeBehavior.disableVertical.ifAvailable();
    } catch {
      return;
    }
    return () => {
      try {
        swipeBehavior.enableVertical.ifAvailable();
      } catch {
        // The SDK is gone (e.g. tests): nothing to restore.
      }
    };
  }, []);
}

/**
 * Paints the Telegram header and background navy while `dark` is true (the stamp screen) and
 * back to the light screen colour after, so the chrome matches the screen.
 */
export function useDarkTelegramChrome(dark: boolean): void {
  useEffect(() => {
    if (!dark) return;
    const paint = (token?: string) => {
      try {
        setChromeColors(token);
      } catch {
        // Outside Telegram (tests): nothing to paint.
      }
    };
    paint(DARK_CHROME_COLOR_TOKEN);
    return () => {
      paint();
    };
  }, [dark]);
}
