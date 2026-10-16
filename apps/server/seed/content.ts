import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTENT_COUNTRY_FILE,
  validateContent,
  type RawContent,
  type SeedCountry,
  type SeedDish,
} from '@tma80/shared';

/** `content/` at the repository root; `CONTENT_DIR` overrides it (tests, a broken copy). */
export const DEFAULT_CONTENT_DIR = fileURLToPath(new URL('../../../content', import.meta.url));

export function contentDir(): string {
  return process.env.CONTENT_DIR ?? DEFAULT_CONTENT_DIR;
}

export interface Content {
  countries: SeedCountry[];
  dishes: SeedDish[];
}

/** The content is invalid; `errors` name the file and the rule. */
export class ContentError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(
      `Content is invalid (${String(errors.length)} errors):\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
    this.name = 'ContentError';
    this.errors = errors;
  }
}

/**
 * Reads `<dir>/<country>/country.json` and `<dir>/<country>/<slug>.json` (other files, e.g.
 * photos, are skipped). A file that is not valid JSON goes to `errors`.
 */
export async function readContent(dir: string): Promise<{ raw: RawContent; errors: string[] }> {
  const countries: RawContent['countries'][number][] = [];
  const dishes: RawContent['dishes'][number][] = [];
  const errors: string[] = [];
  const relative = (file: string) => path.join('content', path.relative(dir, file));

  const folders = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    const files = (await readdir(path.join(dir, folder)))
      .filter((name) => name.endsWith('.json'))
      .sort();
    for (const name of files) {
      const file = path.join(dir, folder, name);
      let data: unknown;
      try {
        data = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        errors.push(`${relative(file)}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      if (name === CONTENT_COUNTRY_FILE) countries.push({ id: folder, path: relative(file), data });
      else
        dishes.push({
          countryId: folder,
          slug: name.slice(0, -'.json'.length),
          path: relative(file),
          data,
        });
    }
  }
  return { raw: { countries, dishes }, errors };
}

/** Reads and validates the content; throws `ContentError` with every problem found. */
export async function loadContent(dir: string = contentDir()): Promise<Content> {
  const { raw, errors } = await readContent(dir);
  const result = validateContent(raw);
  const all = [...errors, ...(result.ok ? [] : result.errors)];
  if (all.length > 0 || !result.ok) throw new ContentError(all);
  return { countries: result.countries, dishes: result.dishes };
}

/** Dishes whose photo `<dir>/<country>/<slug>.webp` is missing (a warning, not an error). */
export function missingPhotos(dishes: readonly SeedDish[], dir: string = contentDir()): string[] {
  return dishes
    .filter((dish) => !existsSync(path.join(dir, dish.imagePath)))
    .map((dish) => dish.imagePath);
}
