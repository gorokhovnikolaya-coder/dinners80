import { describe, expect, it } from 'vitest';

import {
  buildShoppingList,
  shoppingItemSchema,
  shoppingResponseSchema,
  type ShoppingItem,
} from './shopping.ts';

let seq = 0;
const item = (overrides: Partial<ShoppingItem>): ShoppingItem => {
  seq += 1;
  return {
    id: `i${String(seq).padStart(3, '0')}`,
    dishId: 'd1',
    dishTitle: 'Ломо сальтадо',
    product: 'onion',
    name: 'Лук',
    amount: 1,
    unit: 'pcs',
    aisle: 'veg',
    checked: false,
    createdAt: `2026-10-11T10:00:${String(seq % 60).padStart(2, '0')}Z`,
    ...overrides,
  };
};

describe('buildShoppingList', () => {
  it('sums the same product with the same unit across dishes and lists every dish', () => {
    const list = buildShoppingList([
      item({ dishId: 'd1', dishTitle: 'Ломо сальтадо', amount: 1 }),
      item({ dishId: 'd2', dishTitle: 'Оякодон', amount: 1.5, name: 'Лук репчатый' }),
    ]);
    expect(list.aisles).toHaveLength(1);
    const [row] = list.aisles[0]?.rows ?? [];
    expect(row?.amount).toBe(2.5);
    expect(row?.unit).toBe('pcs');
    expect(row?.itemIds).toHaveLength(2);
    expect(row?.dishes.map((dish) => dish.title)).toEqual(['Ломо сальтадо', 'Оякодон']);
    // The name of the earliest added item.
    expect(row?.name).toBe('Лук');
  });

  it('keeps different units of a product as separate rows', () => {
    const list = buildShoppingList([
      item({ product: 'butter', name: 'Масло', amount: 30, unit: 'g', aisle: 'dairy' }),
      item({ product: 'butter', name: 'Масло', amount: 1, unit: 'tbsp', aisle: 'dairy' }),
    ]);
    const rows = list.aisles[0]?.rows ?? [];
    expect(rows.map((row) => [row.amount, row.unit])).toEqual([
      [30, 'g'],
      [1, 'tbsp'],
    ]);
  });

  it('does not sum different products with the same name', () => {
    const list = buildShoppingList([
      item({ product: 'red_onion', name: 'Лук' }),
      item({ product: 'onion', name: 'Лук' }),
    ]);
    expect(list.rowsCount).toBe(2);
  });

  it('keeps bought and unbought items of a product apart', () => {
    const list = buildShoppingList([
      item({ dishId: 'd1', checked: true }),
      item({ dishId: 'd2', dishTitle: 'Оякодон', checked: false }),
      item({ dishId: 'd3', dishTitle: 'Хинкали', checked: false, amount: 2 }),
    ]);
    const rows = list.aisles[0]?.rows ?? [];
    expect(rows.map((row) => [row.checked, row.amount, row.itemIds.length])).toEqual([
      [false, 3, 2],
      [true, 1, 1],
    ]);
    expect(list.rowsCount).toBe(2);
    expect(list.checkedCount).toBe(1);
  });

  it('makes «по вкусу» one row without an amount, with all its dishes', () => {
    const list = buildShoppingList([
      item({ product: 'salt', name: 'Соль', amount: null, unit: null, aisle: 'grocery' }),
      item({
        product: 'salt',
        name: 'Соль',
        amount: null,
        unit: null,
        aisle: 'grocery',
        dishId: 'd2',
        dishTitle: 'Оякодон',
      }),
    ]);
    const rows = list.aisles[0]?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBeNull();
    expect(rows[0]?.dishes).toHaveLength(2);
  });

  it('lists a dish once even if several of its items are in a row', () => {
    const list = buildShoppingList([
      item({ dishId: 'd1', amount: 1 }),
      item({ dishId: 'd1', amount: 2 }),
    ]);
    expect(list.aisles[0]?.rows[0]?.dishes).toEqual([{ id: 'd1', title: 'Ломо сальтадо' }]);
  });

  it('groups by aisle in the fixed order and sorts rows by name', () => {
    const list = buildShoppingList([
      item({ product: 'rice', name: 'Рис', aisle: 'grocery', unit: 'g', amount: 150 }),
      item({ product: 'tomato', name: 'Помидоры', aisle: 'veg' }),
      item({ product: 'beef', name: 'Говядина', aisle: 'meat', unit: 'g', amount: 400 }),
      item({ product: 'cilantro', name: 'Кинза', aisle: 'veg', checked: true }),
      item({ product: 'garlic', name: 'Чеснок', aisle: 'veg', unit: 'clove', amount: 2 }),
    ]);
    expect(list.aisles.map((aisle) => aisle.aisle)).toEqual(['meat', 'veg', 'grocery']);
    expect(list.aisles[1]?.rows.map((row) => row.name)).toEqual(['Кинза', 'Помидоры', 'Чеснок']);
  });

  it('sums without floating point noise', () => {
    const list = buildShoppingList([
      item({ amount: 0.1, unit: 'tsp' }),
      item({ amount: 0.2, unit: 'tsp' }),
    ]);
    expect(list.aisles[0]?.rows[0]?.amount).toBe(0.3);
  });

  it('counts dishes, rows and bought rows', () => {
    const list = buildShoppingList([
      item({ dishId: 'd1', product: 'onion' }),
      item({ dishId: 'd2', product: 'onion' }),
      item({ dishId: 'd2', product: 'rice', name: 'Рис', aisle: 'grocery', checked: true }),
    ]);
    expect(list.dishesCount).toBe(2);
    expect(list.rowsCount).toBe(2);
    expect(list.checkedCount).toBe(1);
  });

  it('is empty for an empty list', () => {
    expect(buildShoppingList([])).toEqual({
      aisles: [],
      dishesCount: 0,
      rowsCount: 0,
      checkedCount: 0,
    });
  });
});

describe('shopping schemas', () => {
  it('accept an item with an amount and a unit, or «по вкусу» without both', () => {
    expect(shoppingItemSchema.safeParse(item({})).success).toBe(true);
    expect(shoppingItemSchema.safeParse(item({ amount: null, unit: null })).success).toBe(true);
    expect(shoppingItemSchema.safeParse(item({ amount: null })).success).toBe(false);
    expect(shoppingResponseSchema.safeParse({ items: [item({})] }).success).toBe(true);
  });
});
