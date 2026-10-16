import { describe, expect, it } from 'vitest';

import { validateContent, type RawContent } from './contentFiles.ts';

const country = (id: string, sort = 1) => ({
  id,
  path: `content/${id}/country.json`,
  data: { nameRu: 'Италия', continent: 'europe', sort },
});

const dishData = (overrides: Record<string, unknown> = {}) => ({
  title: 'Паста',
  level: 'weekday',
  minutes: 20,
  baseServings: 2,
  tags: ['gluten'],
  description: 'Описание.',
  fact: 'Факт.',
  ingredients: [
    { key: 'spaghetti', name: 'Спагетти', amount: 200, unit: 'g', aisle: 'grocery' },
    {
      key: 'pepper',
      product: 'black_pepper',
      name: 'Чёрный перец',
      amount: null,
      unit: null,
      aisle: 'grocery',
    },
  ],
  steps: [{ text: 'Отварите {spaghetti} спагетти.', timerMinutes: 9 }, { text: 'Поперчите.' }],
  ...overrides,
});

const dish = (countryId: string, slug: string, data: unknown) => ({
  countryId,
  slug,
  path: `content/${countryId}/${slug}.json`,
  data,
});

const errorsOf = (raw: RawContent) => {
  const result = validateContent(raw);
  return result.ok ? [] : result.errors;
};

describe('validateContent', () => {
  it('builds seed rows from valid files', () => {
    const result = validateContent({
      countries: [country('it')],
      dishes: [dish('it', 'pasta', dishData())],
    });
    expect(result).toEqual({
      ok: true,
      countries: [{ id: 'it', nameRu: 'Италия', continent: 'europe', sort: 1 }],
      dishes: [
        {
          id: 'it-pasta',
          countryId: 'it',
          slug: 'pasta',
          title: 'Паста',
          level: 'weekday',
          minutes: 20,
          baseServings: 2,
          description: 'Описание.',
          fact: 'Факт.',
          imagePath: 'it/pasta.webp',
          tags: ['gluten'],
          ingredients: [
            {
              key: 'spaghetti',
              product: 'spaghetti',
              name: 'Спагетти',
              amount: 200,
              unit: 'g',
              aisle: 'grocery',
              sort: 0,
            },
            {
              key: 'pepper',
              product: 'black_pepper',
              name: 'Чёрный перец',
              amount: null,
              unit: null,
              aisle: 'grocery',
              sort: 1,
            },
          ],
          steps: [
            { n: 1, text: 'Отварите {spaghetti} спагетти.', timerSeconds: 540 },
            { n: 2, text: 'Поперчите.', timerSeconds: null },
          ],
        },
      ],
    });
  });

  it('fails on a placeholder with an unknown key', () => {
    const steps = [{ text: 'Отварите {spagetti} спагетти.' }];
    expect(
      errorsOf({ countries: [country('it')], dishes: [dish('it', 'pasta', dishData({ steps }))] }),
    ).toEqual(['content/it/pasta.json: step 1 has {spagetti}: no ingredient with this key']);
  });

  it('fails on a placeholder of an ingredient «по вкусу»', () => {
    const steps = [
      { text: 'Добавьте {spaghetti} спагетти.' },
      { text: 'Добавьте {pepper} перца.' },
    ];
    expect(
      errorsOf({ countries: [country('it')], dishes: [dish('it', 'pasta', dishData({ steps }))] }),
    ).toEqual([
      'content/it/pasta.json: step 2 has {pepper}: the ingredient is «по вкусу» (no amount)',
    ]);
  });

  it('fails when one product has different aisles in different dishes', () => {
    const other = dishData({
      ingredients: [{ key: 'spaghetti', name: 'Спагетти', amount: 200, unit: 'g', aisle: 'other' }],
      steps: [{ text: 'Отварите.' }],
    });
    expect(
      errorsOf({
        countries: [country('it')],
        dishes: [dish('it', 'pasta', dishData()), dish('it', 'other', other)],
      }),
    ).toEqual([
      'content/it/other.json: product «spaghetti» is in aisle other, but in content/it/pasta.json it is in grocery',
    ]);
  });

  it('fails on duplicate ingredient keys and an amount without a unit', () => {
    const ingredients = [
      { key: 'egg', name: 'Яйца', amount: 2, unit: 'pcs', aisle: 'dairy' },
      { key: 'egg', name: 'Желтки', amount: 2, unit: 'pcs', aisle: 'dairy' },
    ];
    expect(
      errorsOf({
        countries: [country('it')],
        dishes: [dish('it', 'eggs', dishData({ ingredients, steps: [{ text: 'Взбейте.' }] }))],
      }),
    ).toEqual(['content/it/eggs.json: duplicate ingredient key «egg»']);

    const noUnit = [{ key: 'egg', name: 'Яйца', amount: 2, unit: null, aisle: 'dairy' }];
    expect(
      errorsOf({
        countries: [country('it')],
        dishes: [dish('it', 'eggs', dishData({ ingredients: noUnit, steps: [{ text: 'Ок.' }] }))],
      }),
    ).toHaveLength(1);
  });

  it('fails on schema errors: unknown tag, unknown field, missing title', () => {
    const errors = errorsOf({
      countries: [country('it')],
      dishes: [
        dish('it', 'a', dishData({ tags: ['pork'] })),
        dish('it', 'b', dishData({ extra: 1 })),
        dish('it', 'c', { ...dishData(), title: undefined }),
      ],
    });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/^content\/it\/a\.json at tags\.0: /);
    expect(errors[1]).toMatch(/^content\/it\/b\.json: /);
    expect(errors[2]).toMatch(/^content\/it\/c\.json at title: /);
  });

  it('fails on a dish without country.json, a bad slug and a repeated country sort', () => {
    expect(
      errorsOf({
        countries: [country('it', 1), country('fr', 1)],
        dishes: [dish('es', 'pasta', dishData()), dish('it', 'Pasta', dishData())],
      }),
    ).toEqual([
      'content/fr/country.json: sort 1 is already used by content/it/country.json',
      'content/es/pasta.json: folder es has no country.json',
      'content/it/Pasta.json: file name must match /^[a-z0-9-]+$/',
    ]);
  });
});
