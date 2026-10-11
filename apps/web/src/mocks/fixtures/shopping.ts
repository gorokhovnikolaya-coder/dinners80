import { TEST_USER_IDS } from './users.ts';

/** A shopping item of the fixtures (`shopping_items`): an ingredient of a dish to buy. */
export interface ShoppingFixture {
  id: string;
  dishId: string;
  /** `dish_ingredients.key` within the dish. */
  ingredientKey: string;
  servings: number;
  checked: boolean;
  createdAt: string;
}

const at = (minute: number) => `2026-09-30T15:${String(minute).padStart(2, '0')}:00.000Z`;

const items = (
  prefix: string,
  dishId: string,
  servings: number,
  minute: number,
  keys: readonly (string | [string, 'checked'])[],
): ShoppingFixture[] =>
  keys.map((key, index) => {
    const [ingredientKey, checked] = typeof key === 'string' ? [key, false] : [key[0], true];
    return {
      id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
      dishId,
      ingredientKey,
      servings,
      checked,
      createdAt: at(minute),
    };
  });

/**
 * Shopping lists of the test users. 1002 has two dishes that share products: rice and soy sauce
 * are summed, the two onions are different products (`red_onion`, `onion`), two items are bought.
 * The others start with an empty list.
 */
export const shoppingFixtures: Readonly<Record<number, readonly ShoppingFixture[]>> = {
  [TEST_USER_IDS.eightCountries]: [
    ...items('fx-lomo', 'pe-lomo-saltado', 2, 1, [
      'beef_tenderloin',
      'red_onion',
      ['tomatoes', 'checked'],
      'potatoes',
      'soy_sauce',
      'rice',
      'salt',
    ]),
    ...items('fx-oyako', 'jp-oyakodon', 2, 5, [
      'rice',
      ['chicken_thigh', 'checked'],
      'eggs',
      'soy_sauce',
      'onion',
    ]),
  ],
};
