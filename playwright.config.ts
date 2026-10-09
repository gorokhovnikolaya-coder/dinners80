import { defineConfig } from '@playwright/test';

// A dedicated port, so e2e never reuses a dev server started with other flags.
const PORT = 5179;
const baseURL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    // iPhone 14, light theme — the same as the manual checks in AGENTS.md.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    colorScheme: 'light',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -w @tma80/web -- --port ${String(PORT)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Mock mode regardless of .env: environment variables take precedence over it.
    env: { VITE_TG_MOCK: '1', VITE_API: 'mock' },
  },
});
