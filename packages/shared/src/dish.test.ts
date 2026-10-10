import { describe, expect, it } from 'vitest';

import {
  dishIngredientSchema,
  dishQuerySchema,
  hasCountryAccess,
  paywallErrorSchema,
} from './dish.ts';
import { addShoppingRequestSchema } from './shopping.ts';
import { dishLabel } from './suggestions.ts';

const cook = (dishId: string, countryId: string) => ({
  dishId,
  countryId,
  createdAt: '2026-09-01T18:00:00Z',
});

describe('dishQuerySchema', () => {
  it('takes servings 1–8 from the query string and drops anything else', () => {
    expect(dishQuerySchema.parse({ servings: '3' })).toEqual({ servings: 3 });
    expect(dishQuerySchema.parse({}).servings).toBeUndefined();
    expect(dishQuerySchema.parse({ servings: '0' }).servings).toBeUndefined();
    expect(dishQuerySchema.parse({ servings: '9' }).servings).toBeUndefined();
    expect(dishQuerySchema.parse({ servings: '2.5' }).servings).toBeUndefined();
  });
});

describe('dishIngredientSchema', () => {
  const base = { key: 'beef', product: 'beef', name: 'Говядина', aisle: 'meat' } as const;

  it('accepts an amount with a unit and «to taste» without both', () => {
    expect(
      dishIngredientSchema.safeParse({ ...base, baseAmount: 400, amount: 200, unit: 'g' }).success,
    ).toBe(true);
    expect(
      dishIngredientSchema.safeParse({ ...base, baseAmount: null, amount: null, unit: null })
        .success,
    ).toBe(true);
  });

  it('rejects an amount without a unit and a unit without an amount', () => {
    expect(
      dishIngredientSchema.safeParse({ ...base, baseAmount: 400, amount: 400, unit: null }).success,
    ).toBe(false);
    expect(
      dishIngredientSchema.safeParse({ ...base, baseAmount: null, amount: null, unit: 'g' })
        .success,
    ).toBe(false);
  });
});

describe('paywallErrorSchema', () => {
  it('carries the preview of the closed dish', () => {
    const value = {
      error: {
        code: 'paywall',
        message: 'Subscription required',
        preview: {
          dishId: 'pe-ceviche',
          title: 'Севиче',
          countryId: 'pe',
          countryName: 'Перу',
          imageUrl: '/media/pe/ceviche.webp',
        },
      },
    };
    expect(paywallErrorSchema.parse(value)).toEqual(value);
    expect(
      paywallErrorSchema.safeParse({ error: { code: 'not_found', message: 'x' } }).success,
    ).toBe(false);
  });
});

describe('addShoppingRequestSchema', () => {
  it('needs at least one unique ingredient key and servings 1–8', () => {
    const ok = { dishId: 'pe-ceviche', servings: 2, ingredientKeys: ['fish', 'lime'] };
    expect(addShoppingRequestSchema.safeParse(ok).success).toBe(true);
    expect(addShoppingRequestSchema.safeParse({ ...ok, ingredientKeys: [] }).success).toBe(false);
    expect(
      addShoppingRequestSchema.safeParse({ ...ok, ingredientKeys: ['fish', 'fish'] }).success,
    ).toBe(false);
    expect(addShoppingRequestSchema.safeParse({ ...ok, servings: 9 }).success).toBe(false);
  });
});

describe('hasCountryAccess', () => {
  const nine = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  const ten = new Set([...nine, 'j']);

  it('opens any country while fewer than 10 are passed', () => {
    expect(hasCountryAccess('z', nine, false)).toBe(true);
  });

  it('with 10 passed: passed countries only, or everything with a subscription', () => {
    expect(hasCountryAccess('a', ten, false)).toBe(true);
    expect(hasCountryAccess('z', ten, false)).toBe(false);
    expect(hasCountryAccess('z', ten, true)).toBe(true);
  });
});

describe('dishLabel', () => {
  const dish = { id: 'pe-ceviche', countryId: 'pe' };

  it('marks a dish of a country without cooks as a new country', () => {
    expect(dishLabel(dish, [cook('it-carbonara', 'it')])).toEqual({ kind: 'newCountry' });
  });

  it('counts different cooked dishes of the country for «N-е блюдо»', () => {
    const cooks = [cook('pe-lomo', 'pe'), cook('pe-lomo', 'pe'), cook('pe-aji', 'pe')];
    expect(dishLabel(dish, cooks)).toEqual({ kind: 'nthDish', n: 3 });
  });

  it('marks a dish the user has cooked', () => {
    expect(dishLabel(dish, [cook('pe-ceviche', 'pe')])).toEqual({ kind: 'cookedBefore' });
  });
});
