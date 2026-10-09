import { backButton } from '@tma.js/sdk-react';
import { useEffect } from 'react';

import { CHROME_COLOR_TOKEN } from '../theme/tokens.ts';
import { setChromeColors } from './sdk.ts';

/**
 * Shows the Telegram BackButton while `onBack` is set and calls it on press; hides the button on
 * unmount. Pass a stable callback (`useCallback`). Does nothing in clients without BackButton.
 */
export function useTelegramBackButton(onBack: (() => void) | undefined): void {
  useEffect(() => {
    if (!onBack) return;
    const subscription = backButton.onClick.ifAvailable(onBack);
    backButton.show.ifAvailable();
    return () => {
      if (subscription.ok) subscription.data();
      backButton.hide.ifAvailable();
    };
  }, [onBack]);
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
