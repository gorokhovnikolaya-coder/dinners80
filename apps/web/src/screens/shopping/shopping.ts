import type { ShoppingList, ShoppingRow } from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';
import { formatAmount } from '../dish/dish.ts';

const t = ru.shopping;

/** «400 г», «1,5 шт», «по вкусу». */
export const formatRowAmount = (row: Pick<ShoppingRow, 'amount' | 'unit'>) =>
  formatAmount(row.amount, row.unit);

/** «Ломо сальтадо, Оякодон». */
export const rowDishes = (row: Pick<ShoppingRow, 'dishes'>) =>
  row.dishes.map((dish) => dish.title).join(', ');

/** Rows still to buy (the cart counter on the main screen). */
export const unboughtCount = (list: Pick<ShoppingList, 'rowsCount' | 'checkedCount'>) =>
  list.rowsCount - list.checkedCount;

/**
 * Text of the list for a chat: the heading, then every aisle that has rows to buy, with those
 * rows; bought rows are left out. `undefined` if there is nothing to buy.
 */
export function shoppingText(list: ShoppingList): string | undefined {
  const blocks = list.aisles.flatMap((aisle) => {
    const rows = aisle.rows.filter((row) => !row.checked);
    if (rows.length === 0) return [];
    return [
      [
        t.aisles[aisle.aisle],
        ...rows.map((row) => t.shareRow(row.name, formatRowAmount(row))),
      ].join('\n'),
    ];
  });
  return blocks.length === 0 ? undefined : [t.shareTitle, ...blocks].join('\n\n');
}
