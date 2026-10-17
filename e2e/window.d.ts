// Mirrors the globals of the mock Telegram env (apps/web/src/telegram/mock/index.ts) and MSW.
export {};

declare global {
  interface Window {
    __tgMockCalls?: string[];
    __tgMockParams?: Record<string, unknown>;
    /** The `events` table of the mock backend (apps/web/src/mocks/browser.ts). */
    tma80MockEvents?: () => readonly { name: string; props: Record<string, unknown> }[];
  }
}
