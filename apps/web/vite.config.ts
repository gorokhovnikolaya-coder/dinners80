import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // One .env for the whole monorepo lives in the repository root.
  envDir: '../..',
  build: {
    // dist/.vite/manifest.json — size-limit uses it to find the initial chunks.
    manifest: true,
  },
});
