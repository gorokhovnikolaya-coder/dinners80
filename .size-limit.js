// Initial JS and CSS of the mini app: the entry chunk plus everything it imports statically.
// Lazy screens (dynamic imports) are excluded. Fonts are not counted: they load with
// `font-display: swap` and never block the first screen. Chunk names come from Vite's build manifest,
// so `apps/web` must be built first (`npm run size` does it).
import { existsSync, readFileSync } from 'node:fs';

const dist = 'apps/web/dist';
const manifestPath = `${dist}/.vite/manifest.json`;

if (!existsSync(manifestPath)) {
  throw new Error(`${manifestPath} not found — run "npm run build -w @tma80/web" first`);
}

/** @type {Record<string, { file: string; isEntry?: boolean; imports?: string[]; css?: string[] }>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const initial = new Set();
const initialCss = new Set();
/** @param {string} key */
const visit = (key) => {
  const chunk = manifest[key];
  if (!chunk || initial.has(chunk.file)) return;
  initial.add(chunk.file);
  chunk.css?.forEach((file) => initialCss.add(file));
  chunk.imports?.forEach(visit);
};
Object.keys(manifest)
  .filter((key) => manifest[key]?.isEntry)
  .forEach(visit);

export default [
  {
    name: 'web: initial JS',
    path: [...initial].map((file) => `${dist}/${file}`),
    limit: '200 kB',
    gzip: true,
  },
  {
    name: 'web: initial CSS',
    path: [...initialCss].map((file) => `${dist}/${file}`),
    limit: '20 kB',
    gzip: true,
  },
];
