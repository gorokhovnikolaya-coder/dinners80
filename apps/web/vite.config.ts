import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// One .env for the whole monorepo lives in the repository root.
const envDir = '../..';

/** Dev-only flags: the mock Telegram environment and MSW must never reach a production build. */
const MOCK_DEFAULTS = { VITE_TG_MOCK: '1', VITE_API: 'mock' } as const;

/**
 * Serves MSW's `mockServiceWorker.js` from node_modules in dev only. The worker is not copied to
 * `public/`, so it never reaches the production build and always matches the installed msw.
 */
function mswWorker(): Plugin {
  const workerPath = createRequire(import.meta.url).resolve('msw/mockServiceWorker.js');
  return {
    name: 'tma80:msw-worker',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(workerPath));
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');

  if (command === 'serve') {
    // `npm run dev` defaults to mock mode; .env or the shell can still override (e.g. VITE_API=local).
    for (const [key, value] of Object.entries(MOCK_DEFAULTS)) {
      process.env[key] ??= env[key] ?? value;
    }
  } else if (mode === 'production') {
    const leaked = Object.entries(MOCK_DEFAULTS)
      .filter(([key, value]) => env[key] === value)
      .map(([key]) => key);
    if (leaked.length > 0) {
      throw new Error(
        `Production build with dev-only mock flags: ${leaked.join(', ')}. ` +
          'Remove them from .env / the environment, or build with another --mode.',
      );
    }
  }

  return {
    plugins: [react(), tailwindcss(), mswWorker()],
    envDir,
    build: {
      // dist/.vite/manifest.json — size-limit uses it to find the initial chunks.
      manifest: true,
    },
    test: {
      // jest-dom matchers and Testing Library cleanup; component tests opt into jsdom per file.
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
