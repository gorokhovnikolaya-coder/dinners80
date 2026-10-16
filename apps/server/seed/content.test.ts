import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CONTINENTS, DISH_LEVELS } from '@tma80/shared';

import { ContentError, loadContent } from './content.ts';

describe('content/ of the repository', () => {
  it('is valid: 30 countries × 3 dishes, one per level', async () => {
    const content = await loadContent();
    expect(content.countries).toHaveLength(30);
    expect(content.dishes).toHaveLength(90);
    for (const country of content.countries) {
      const levels = content.dishes
        .filter((dish) => dish.countryId === country.id)
        .map((dish) => dish.level)
        .sort();
      expect(levels, country.id).toEqual([...DISH_LEVELS].sort());
    }
    expect(new Set(content.countries.map((country) => country.continent))).toEqual(
      new Set(CONTINENTS),
    );
  });
});

describe('loadContent', () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true });
  });

  const write = async (file: string, data: string) => {
    dir ??= await mkdtemp(path.join(tmpdir(), 'tma80-content-'));
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), data);
    return dir;
  };

  const country = JSON.stringify({ nameRu: 'Италия', continent: 'europe', sort: 1 });
  const dish = (step: string) =>
    JSON.stringify({
      title: 'Паста',
      level: 'weekday',
      minutes: 20,
      baseServings: 2,
      tags: [],
      description: 'Описание.',
      fact: 'Факт.',
      ingredients: [{ key: 'pasta', name: 'Паста', amount: 200, unit: 'g', aisle: 'grocery' }],
      steps: [{ text: step }],
    });

  it('loads a valid folder and skips photos', async () => {
    await write('it/country.json', country);
    await write('it/pasta.webp', '');
    const root = await write('it/pasta.json', dish('Отварите {pasta} пасты.'));
    const content = await loadContent(root);
    expect(content.dishes.map((item) => item.id)).toEqual(['it-pasta']);
  });

  it('fails on a file with a wrong placeholder', async () => {
    await write('it/country.json', country);
    const root = await write('it/pasta.json', dish('Отварите {spagetti} пасты.'));
    const error: unknown = await loadContent(root).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).errors).toEqual([
      `${path.join('content', 'it', 'pasta.json')}: step 1 has {spagetti}: no ingredient with this key`,
    ]);
  });

  it('fails on a file that is not JSON', async () => {
    await write('it/country.json', country);
    const root = await write('it/pasta.json', '{ broken');
    await expect(loadContent(root)).rejects.toThrow(/content\/it\/pasta\.json/);
  });
});
