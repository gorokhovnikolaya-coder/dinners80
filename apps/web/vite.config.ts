import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// One .env for the whole monorepo lives in the repository root.
const envDir = '../..';

/** Dev-only flags: the mock Telegram environment and MSW must never reach a production build. */
const MOCK_DEFAULTS = { VITE_TG_MOCK: '1', VITE_API: 'mock' } as const;

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
    plugins: [react()],
    envDir,
    build: {
      // dist/.vite/manifest.json — size-limit uses it to find the initial chunks.
      manifest: true,
    },
  };
});
