import { scaleAmount, type DishIngredient, type DishResponse } from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';

const t = ru.dish;

/** `1.5` → «1,5». */
const formatNumber = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, useGrouping: false }).format(value);

/** «400 г», «1,5 шт», «по вкусу». */
export function formatAmount(amount: number | null, unit: DishIngredient['unit']): string {
  if (amount === null || unit === null) return t.toTaste;
  return `${formatNumber(amount)} ${t.units[unit]}`;
}

/** Amount of an ingredient for the servings chosen on the card. */
export function amountFor(
  ingredient: DishIngredient,
  dish: Pick<DishResponse, 'baseServings'>,
  servings: number,
): number | null {
  return scaleAmount(
    { amount: ingredient.baseAmount, unit: ingredient.unit },
    dish.baseServings,
    servings,
  );
}

/** Keys of the ingredients to buy: those not marked «есть дома», in the recipe order. */
export function keysToBuy(
  ingredients: readonly DishIngredient[],
  atHome: readonly string[],
): string[] {
  const home = new Set(atHome);
  return ingredients.map((ingredient) => ingredient.key).filter((key) => !home.has(key));
}
