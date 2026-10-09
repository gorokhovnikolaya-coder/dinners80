import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each workspace package is a Vitest project; apps/web picks up its vite.config.ts.
    projects: ['packages/*', 'apps/*'],
    passWithNoTests: true,
  },
});
