import type { DishIngredient } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { ru } from '../../i18n/ru.ts';
import { amountFor, formatAmount, keysToBuy } from './dish.ts';
import { atHomeToggled, dishSlice, servingsChosen } from './dishSlice.ts';

const ingredient = (key: string, baseAmount: number | null, unit: DishIngredient['unit']) => ({
  key,
  product: key,
  name: key,
  baseAmount,
  amount: baseAmount,
  unit,
  aisle: 'veg' as const,
});

describe('formatAmount', () => {
  it('writes the amount with a comma and a short unit; «по вкусу» without one', () => {
    expect(formatAmount(400, 'g')).toBe('400 г');
    expect(formatAmount(1.5, 'pcs')).toBe('1,5 шт');
    expect(formatAmount(3, 'tbsp')).toBe('3 ст. л.');
    expect(formatAmount(1200, 'g')).toBe('1200 г');
    expect(formatAmount(null, null)).toBe('по вкусу');
  });
});

describe('amountFor', () => {
  it('recalculates from the base amount for the chosen servings', () => {
    const dish = { baseServings: 2 };
    expect(amountFor(ingredient('fish', 400, 'g'), dish, 3)).toBe(600);
    expect(amountFor(ingredient('lime', 1, 'pcs'), dish, 1)).toBe(0.5);
    expect(amountFor(ingredient('salt', null, null), dish, 8)).toBeNull();
  });
});

describe('keysToBuy', () => {
  it('keeps the ingredients not marked «есть дома», in recipe order', () => {
    const list = [
      ingredient('a', 1, 'pcs'),
      ingredient('b', 1, 'pcs'),
      ingredient('c', null, null),
    ];
    expect(keysToBuy(list, ['b'])).toEqual(['a', 'c']);
    expect(keysToBuy(list, ['a', 'b', 'c'])).toEqual([]);
  });
});

describe('servings word', () => {
  it('agrees with the count', () => {
    const word = ru.dish.servings.word;
    expect([1, 2, 4, 5, 8, 11, 12, 21, 22].map(word)).toEqual([
      'порция',
      'порции',
      'порции',
      'порций',
      'порций',
      'порций',
      'порций',
      'порция',
      'порции',
    ]);
  });
});

describe('dishSlice', () => {
  it('keeps servings within 1–8 and «есть дома» marks per dish', () => {
    let state = dishSlice.reducer(undefined, servingsChosen({ dishId: 'd', servings: 9 }));
    expect(state.servings).toEqual({ d: 8 });
    state = dishSlice.reducer(state, servingsChosen({ dishId: 'd', servings: 0 }));
    expect(state.servings).toEqual({ d: 1 });

    state = dishSlice.reducer(state, atHomeToggled({ dishId: 'd', key: 'a', atHome: true }));
    state = dishSlice.reducer(state, atHomeToggled({ dishId: 'd', key: 'b', atHome: true }));
    state = dishSlice.reducer(state, atHomeToggled({ dishId: 'd', key: 'a', atHome: false }));
    state = dishSlice.reducer(state, atHomeToggled({ dishId: 'e', key: 'a', atHome: true }));
    expect(state.atHome).toEqual({ d: ['b'], e: ['a'] });
  });
});
