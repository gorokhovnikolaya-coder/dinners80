import { init, miniApp, retrieveRawInitData, viewport } from '@tma.js/sdk-react';

/**
 * Header and background colour of the Telegram chrome. The MVP theme is light and fixed, so
 * Telegram colours are not used. The value is the screen background from the mockup.
 * TODO(task 3): take it from the design tokens.
 */
const APP_BACKGROUND_COLOR = '#F3F5F7';

const setChromeColors = () => {
  if (miniApp.setHeaderColor.isAvailable()) {
    // Hex colours for the header need Mini Apps 6.9+; older clients only accept theme keys.
    miniApp.setHeaderColor(
      miniApp.setHeaderColor.supports('rgb') ? APP_BACKGROUND_COLOR : 'bg_color',
    );
  }
  miniApp.setBgColor.ifAvailable(APP_BACKGROUND_COLOR);
};

/**
 * Initialises the Telegram SDK at startup: `ready()`, `expand()`, light header and background,
 * safe area insets as CSS variables (`--tg-viewport-safe-area-inset-*`,
 * `--tg-viewport-content-safe-area-inset-*`). Every call is guarded by an availability check,
 * so old clients and the browser outside Telegram do not crash.
 * @returns `false` if the app is not running inside Telegram (no launch parameters).
 */
export async function initTelegram(): Promise<boolean> {
  try {
    init();
  } catch (error) {
    console.error('Telegram SDK init failed: not in a Telegram environment', error);
    return false;
  }

  miniApp.mount.ifAvailable();
  setChromeColors();
  miniApp.ready.ifAvailable();

  if (viewport.mount.isAvailable()) {
    try {
      await viewport.mount();
      viewport.bindCssVars.ifAvailable();
    } catch (error) {
      console.error('Telegram viewport mount failed', error);
    }
  }
  viewport.expand.ifAvailable();
  return true;
}

/** Raw initData string for the `Authorization: tma <initData>` header. */
export function getRawInitData(): string | undefined {
  try {
    return retrieveRawInitData();
  } catch {
    return undefined;
  }
}
