import { emitEvent, mockTelegramEnv } from '@tma.js/sdk-react';

import { setMockBackButtonVisible } from './backButton.ts';
import { buildMockInitData } from './initData.ts';
import { resolveTestUser } from './testUser.ts';

declare global {
  interface Window {
    /** Mini Apps methods called by the app in mock mode, for e2e checks. */
    __tgMockCalls?: string[];
    /** Parameters of the last call of each Mini Apps method in mock mode, for e2e checks. */
    __tgMockParams?: Record<string, unknown>;
  }
}

/** Mini Apps version the mock client reports. */
const MOCK_VERSION = '9.0';

/** Telegram light theme. The app ignores it (fixed light theme), but the SDK requires it. */
const themeParams = {
  bg_color: '#ffffff',
  secondary_bg_color: '#f1f1f1',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#2481cc',
  button_color: '#2481cc',
  button_text_color: '#ffffff',
  header_bg_color: '#ffffff',
  accent_text_color: '#2481cc',
  section_bg_color: '#ffffff',
  section_header_text_color: '#6d6d72',
  subtitle_text_color: '#999999',
  destructive_text_color: '#e53935',
} as const;

/** Safe area of an iPhone 14 in the default (non-fullscreen) mode: only the home indicator. */
const safeArea = { top: 0, bottom: 34, left: 0, right: 0 };
const contentSafeArea = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Imitates the Telegram client in a regular browser (`VITE_TG_MOCK=1`): launch parameters with
 * the test user from `?user=<id>`, light theme, viewport and safe area.
 */
export function mockTelegram(): void {
  const user = resolveTestUser(window.location.search);
  const calls: string[] = [];
  const params: Record<string, unknown> = {};
  window.__tgMockCalls = calls;
  window.__tgMockParams = params;

  mockTelegramEnv({
    launchParams: {
      tgWebAppThemeParams: themeParams,
      tgWebAppData: buildMockInitData(user.tg),
      // `?mock_tg_version=6.0` imitates an old client (e.g. without BackButton, added in 6.1).
      tgWebAppVersion:
        new URLSearchParams(window.location.search).get('mock_tg_version') ?? MOCK_VERSION,
      tgWebAppPlatform: 'ios',
    },
    onEvent(event) {
      calls.push(event.name);
      params[event.name] = 'params' in event ? event.params : undefined;
      switch (event.name) {
        case 'web_app_request_theme':
          emitEvent('theme_changed', { theme_params: themeParams });
          return;
        case 'web_app_request_viewport':
          emitEvent('viewport_changed', {
            height: window.innerHeight,
            width: window.innerWidth,
            is_expanded: true,
            is_state_stable: true,
          });
          return;
        case 'web_app_request_safe_area':
          emitEvent('safe_area_changed', safeArea);
          return;
        case 'web_app_request_content_safe_area':
          emitEvent('content_safe_area_changed', contentSafeArea);
          return;
        case 'web_app_setup_back_button':
          setMockBackButtonVisible(
            typeof event.params === 'object' &&
              event.params !== null &&
              'is_visible' in event.params &&
              event.params.is_visible === true,
          );
          return;
        default:
          // Other methods (ready, expand, colours…) have no visible effect in the browser.
          return;
      }
    },
    resetPostMessage: true,
  });

  console.info(`[tg mock] user ${String(user.tg.id)} — ${user.tg.first_name} (${user.state})`);
}
