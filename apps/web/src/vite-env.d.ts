/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. `/api`. */
  readonly VITE_API_URL?: string;
  /** `1` — mock Telegram environment (dev only). */
  readonly VITE_TG_MOCK?: string;
  /** `mock` — MSW fixtures, `local` — local Node server. */
  readonly VITE_API?: 'mock' | 'local';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
