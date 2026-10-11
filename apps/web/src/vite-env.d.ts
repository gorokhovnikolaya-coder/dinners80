/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. `/api`. */
  readonly VITE_API_URL?: string;
  /** `1` — mock Telegram environment (dev only). */
  readonly VITE_TG_MOCK?: string;
  /** `mock` — MSW fixtures, `local` — local Node server. */
  readonly VITE_API?: 'mock' | 'local';
  /** Bot username for the invite link `t.me/<bot>/<app>?startapp=<code>`, without `@`. */
  readonly VITE_BOT_USERNAME?: string;
  /** Short name of the mini app in BotFather for the invite link. */
  readonly VITE_APP_SHORT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
