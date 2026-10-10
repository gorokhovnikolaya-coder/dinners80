import { describe, expect, it } from 'vitest';

import { clampServings, defaultServings, roundAmount, scaleAmount } from './servings.ts';

describe('defaultServings', () => {
  it('follows «who eats»: solo 1, couple 2, family 4; 2 when unknown', () => {
    expect(defaultServings('solo')).toBe(1);
    expect(defaultServings('couple')).toBe(2);
    expect(defaultServings('family')).toBe(4);
    expect(defaultServings(null)).toBe(2);
  });
});

describe('clampServings', () => {
  it('keeps servings whole and within 1–8', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(-3)).toBe(1);
    expect(clampServings(9)).toBe(8);
    expect(clampServings(3.4)).toBe(3);
    expect(clampServings(Number.NaN)).toBe(1);
  });
});

describe('roundAmount', () => {
  it('rounds grams and millilitres: whole below 10, step 5 below 100, step 10 from 100', () => {
    expect(roundAmount(0.3, 'g')).toBe(1);
    expect(roundAmount(7.4, 'g')).toBe(7);
    expect(roundAmount(9.6, 'ml')).toBe(10);
    expect(roundAmount(12, 'g')).toBe(10);
    expect(roundAmount(12.5, 'g')).toBe(15);
    expect(roundAmount(97.5, 'ml')).toBe(100);
    expect(roundAmount(133.3, 'g')).toBe(130);
    expect(roundAmount(135, 'g')).toBe(140);
    expect(roundAmount(1600, 'g')).toBe(1600);
  });

  it('rounds pieces and spoons to halves, at least a half', () => {
    expect(roundAmount(0.1, 'pcs')).toBe(0.5);
    expect(roundAmount(0.75, 'pcs')).toBe(1);
    expect(roundAmount(1.2, 'tbsp')).toBe(1);
    expect(roundAmount(1.25, 'tsp')).toBe(1.5);
    expect(roundAmount(2.6, 'pcs')).toBe(2.5);
  });

  it('rounds cloves and pinches to whole, at least 1', () => {
    expect(roundAmount(0.4, 'clove')).toBe(1);
    expect(roundAmount(1.5, 'clove')).toBe(2);
    expect(roundAmount(2.4, 'pinch')).toBe(2);
  });
});

describe('scaleAmount', () => {
  it('recalculates from the base servings and rounds', () => {
    expect(scaleAmount({ amount: 400, unit: 'g' }, 2, 1)).toBe(200);
    expect(scaleAmount({ amount: 400, unit: 'g' }, 2, 3)).toBe(600);
    expect(scaleAmount({ amount: 250, unit: 'g' }, 2, 1)).toBe(130);
    expect(scaleAmount({ amount: 3, unit: 'pcs' }, 2, 1)).toBe(1.5);
    expect(scaleAmount({ amount: 1, unit: 'pcs' }, 2, 1)).toBe(0.5);
    expect(scaleAmount({ amount: 3, unit: 'tbsp' }, 2, 5)).toBe(7.5);
    expect(scaleAmount({ amount: 2, unit: 'clove' }, 2, 1)).toBe(1);
    expect(scaleAmount({ amount: 1, unit: 'pinch' }, 2, 1)).toBe(1);
  });

  it('keeps the content amount as is for the base servings', () => {
    expect(scaleAmount({ amount: 133, unit: 'g' }, 2, 2)).toBe(133);
  });

  it('leaves «to taste» without an amount', () => {
    expect(scaleAmount({ amount: null, unit: null }, 2, 8)).toBeNull();
  });
});
