import type { DishIngredient } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { stepSegments } from './stepText.ts';

const beef: DishIngredient = {
  key: 'beef',
  product: 'beef',
  name: 'Говядина',
  baseAmount: 400,
  amount: 400,
  unit: 'g',
  aisle: 'meat',
};
const dish = { ingredients: [beef], baseServings: 2 };

describe('stepSegments', () => {
  it('replaces placeholders with the amount for the servings', () => {
    expect(stepSegments('Обжарьте {beef} говядины.', dish, 3)).toEqual([
      { kind: 'text', text: 'Обжарьте ' },
      { kind: 'amount', text: '600 г' },
      { kind: 'text', text: ' говядины.' },
    ]);
  });

  it('drops a placeholder of an unknown ingredient instead of showing it raw', () => {
    expect(stepSegments('Добавьте {onion} лука.', dish, 2)).toEqual([
      { kind: 'text', text: 'Добавьте ' },
      { kind: 'text', text: ' лука.' },
    ]);
  });
});
