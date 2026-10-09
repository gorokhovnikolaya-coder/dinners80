// Mirrors the global declared by apps/web/src/telegram/mock/index.ts (mock Telegram env).
export {};

declare global {
  interface Window {
    __tgMockCalls?: string[];
    __tgMockParams?: Record<string, unknown>;
  }
}
