import { z } from 'zod/mini';

import { AISLES, INGREDIENT_UNITS, SERVINGS_MAX, SERVINGS_MIN, type Aisle } from './constants.ts';

/**
 * Body of `POST /api/shopping`: ingredients of a dish to buy, for the chosen servings (the dish
 * card's cart button sends the ones not marked «есть дома»). The server replaces the dish's
 * unchecked items with these, so adding a dish again does not duplicate it; bought (checked)
 * items stay.
 */
export const addShoppingRequestSchema = z.object({
  dishId: z.string().check(z.minLength(1)),
  servings: z.int().check(z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX)),
  /** `dish_ingredients.key` of the dish; unique, at least one. */
  ingredientKeys: z.array(z.string().check(z.minLength(1))).check(
    z.minLength(1),
    z.refine((keys) => new Set(keys).size === keys.length, 'Duplicate ingredient keys'),
  ),
});
export type AddShoppingRequest = z.infer<typeof addShoppingRequestSchema>;

/** Response of `POST /api/shopping`: how many items of the dish are now in the list. */
export const addShoppingResponseSchema = z.object({
  added: z.int().check(z.positive()),
});
export type AddShoppingResponse = z.infer<typeof addShoppingResponseSchema>;

/**
 * An item of `GET /api/shopping` (`shopping_items` joined with the ingredient and the dish): an
 * ingredient of a dish to buy, its amount already recalculated for the item's servings
 * (`scaleAmount`). `amount` and `unit` are both `null` for «по вкусу».
 */
export const shoppingItemSchema = z
  .object({
    id: z.string().check(z.minLength(1)),
    dishId: z.string().check(z.minLength(1)),
    dishTitle: z.string().check(z.minLength(1)),
    /** Common product key (`dish_ingredients.product`): the list sums by it and the unit. */
    product: z.string().check(z.minLength(1)),
    name: z.string().check(z.minLength(1)),
    amount: z.nullable(z.number().check(z.positive())),
    unit: z.nullable(z.enum(INGREDIENT_UNITS)),
    aisle: z.enum(AISLES),
    checked: z.boolean(),
    /** When the item was added (ISO 8601): the name of a summed row is the earliest one's. */
    createdAt: z.iso.datetime({ offset: true }),
  })
  .check(
    z.refine(
      (item) => (item.amount === null) === (item.unit === null),
      'An amount needs a unit; «to taste» has neither',
    ),
  );
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

/** Response of `GET /api/shopping`: the user's items, oldest first. */
export const shoppingResponseSchema = z.object({
  items: z.array(shoppingItemSchema),
});
export type ShoppingResponse = z.infer<typeof shoppingResponseSchema>;

/** Body of `PATCH /api/shopping/:id`: mark the item bought or not. */
export const updateShoppingItemRequestSchema = z.object({
  checked: z.boolean(),
});
export type UpdateShoppingItemRequest = z.infer<typeof updateShoppingItemRequestSchema>;

/** Response of `PATCH /api/shopping/:id`: the changed item. */
export const updateShoppingItemResponseSchema = shoppingItemSchema;
export type UpdateShoppingItemResponse = ShoppingItem;

/** Response of `DELETE /api/shopping/checked`: how many bought items were removed. */
export const clearShoppingResponseSchema = z.object({
  removed: z.int().check(z.gte(0)),
});
export type ClearShoppingResponse = z.infer<typeof clearShoppingResponseSchema>;

/** A dish a row of the shopping list is needed for. */
export interface ShoppingRowDish {
  id: string;
  title: string;
}

/**
 * A row of the shopping list: the items of one product with the same unit and the same «bought»
 * state, summed. Bought and unbought items of a product are separate rows, so marking a row marks
 * every item in it.
 */
export interface ShoppingRow {
  /**
   * Key for lists: the id of the row's earliest item, so a row keeps its key (and focus) when it
   * is marked, unless it merges with another row.
   */
  key: string;
  /** Ids of the summed items (`PATCH /shopping/:id` for each). */
  itemIds: string[];
  product: string;
  /** Name of the earliest added item. */
  name: string;
  /** Sum of the items' amounts; `null` — «по вкусу». */
  amount: number | null;
  unit: ShoppingItem['unit'];
  checked: boolean;
  /** Dishes of the items, in the order they were added, without repeats. */
  dishes: ShoppingRowDish[];
}

export interface ShoppingAisle {
  aisle: Aisle;
  /** Alphabetical by name; a row keeps its place when marked. */
  rows: ShoppingRow[];
}

export interface ShoppingList {
  /** Non-empty aisles in the fixed order of `AISLES`. */
  aisles: ShoppingAisle[];
  /** Different dishes in the list. */
  dishesCount: number;
  /** Rows shown and rows marked bought (the «куплено X из Y» counter). */
  rowsCount: number;
  checkedCount: number;
}

/** Sums without binary noise: `0.1 + 0.2` → `0.3` (amounts have at most 2 decimals). */
const addAmounts = (a: number, b: number) => Math.round((a + b) * 100) / 100;

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

/**
 * Groups the shopping items for the screen (ТЗ, экран 7): by aisle in the fixed order; within an
 * aisle the same `product` with the same unit and state is summed into one row listing all its
 * dishes; different units of a product stay separate rows; «по вкусу» is a row without an amount.
 * Rows are sorted by name (then unbought first), so marking a row does not move other rows.
 */
export function buildShoppingList(items: readonly ShoppingItem[]): ShoppingList {
  const ordered = [...items].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
  );
  const rows = new Map<string, ShoppingRow>();
  const aisleOf = new Map<string, Aisle>();
  for (const item of ordered) {
    const key = `${item.product}|${item.unit ?? ''}|${item.checked ? '1' : '0'}`;
    const row = rows.get(key);
    if (!row) {
      rows.set(key, {
        key: item.id,
        itemIds: [item.id],
        product: item.product,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        checked: item.checked,
        dishes: [{ id: item.dishId, title: item.dishTitle }],
      });
      aisleOf.set(item.id, item.aisle);
      continue;
    }
    row.itemIds.push(item.id);
    if (row.amount !== null && item.amount !== null)
      row.amount = addAmounts(row.amount, item.amount);
    if (!row.dishes.some((dish) => dish.id === item.dishId))
      row.dishes.push({ id: item.dishId, title: item.dishTitle });
  }

  const all = [...rows.values()];
  const aisles = AISLES.flatMap((aisle): ShoppingAisle[] => {
    const inAisle = all
      .filter((row) => aisleOf.get(row.key) === aisle)
      .sort(
        (a, b) =>
          collator.compare(a.name, b.name) ||
          Number(a.checked) - Number(b.checked) ||
          (a.unit ?? '').localeCompare(b.unit ?? ''),
      );
    return inAisle.length === 0 ? [] : [{ aisle, rows: inAisle }];
  });

  return {
    aisles,
    dishesCount: new Set(items.map((item) => item.dishId)).size,
    rowsCount: all.length,
    checkedCount: all.filter((row) => row.checked).length,
  };
}
