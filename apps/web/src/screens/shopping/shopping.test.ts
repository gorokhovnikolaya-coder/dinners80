import { buildShoppingList, type ShoppingItem } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { formatRowAmount, rowDishes, shoppingText, unboughtCount } from './shopping.ts';

const item = (overrides: Partial<ShoppingItem> & Pick<ShoppingItem, 'id'>): ShoppingItem => ({
  dishId: 'd1',
  dishTitle: 'Ломо сальтадо',
  product: 'onion',
  name: 'Лук',
  amount: 1,
  unit: 'pcs',
  aisle: 'veg',
  checked: false,
  createdAt: '2026-10-11T10:00:00Z',
  ...overrides,
});

const list = buildShoppingList([
  item({ id: 'a', product: 'beef', name: 'Говядина', amount: 400, unit: 'g', aisle: 'meat' }),
  item({ id: 'b', amount: 1.5 }),
  item({ id: 'c', product: 'tomato', name: 'Томаты', checked: true }),
  item({ id: 'd', product: 'chicken', name: 'Курица', aisle: 'meat', checked: true }),
  item({ id: 'e', product: 'salt', name: 'Соль', amount: null, unit: null, aisle: 'grocery' }),
  item({
    id: 'f',
    product: 'salt',
    name: 'Соль',
    amount: null,
    unit: null,
    aisle: 'grocery',
    dishId: 'd2',
    dishTitle: 'Оякодон',
  }),
]);

describe('shopping list helpers', () => {
  it('formats amounts and dishes of a row', () => {
    const rows = list.aisles.flatMap((aisle) => aisle.rows);
    expect(rows.map(formatRowAmount)).toEqual(['400 г', '1 шт', '1,5 шт', '1 шт', 'по вкусу']);
    expect(rowDishes(rows[rows.length - 1] ?? { dishes: [] })).toBe('Ломо сальтадо, Оякодон');
  });

  it('counts the rows left to buy', () => {
    expect(unboughtCount(list)).toBe(3);
  });

  it('builds the chat text from the unbought rows only, by aisle', () => {
    expect(shoppingText(list)).toBe(
      [
        'Список покупок',
        'Мясо и рыба\n• Говядина — 400 г',
        'Овощи и зелень\n• Лук — 1,5 шт',
        'Бакалея\n• Соль — по вкусу',
      ].join('\n\n'),
    );
  });

  it('has no text when everything is bought', () => {
    expect(shoppingText(buildShoppingList([item({ id: 'a', checked: true })]))).toBeUndefined();
    expect(shoppingText(buildShoppingList([]))).toBeUndefined();
  });
});
