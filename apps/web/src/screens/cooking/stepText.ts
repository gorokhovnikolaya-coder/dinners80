import { splitStepText, type DishResponse } from '@tma80/shared';

import { amountFor, formatAmount } from '../dish/dish.ts';

/** A piece of a step on screen: plain text or an ingredient amount («400 г»), highlighted. */
export interface StepSegment {
  kind: 'text' | 'amount';
  text: string;
}

/**
 * The step text with `{key}` replaced by the ingredient amount for `servings`. A placeholder of
 * an unknown ingredient (broken content; the seed refuses it) is dropped, never shown raw.
 */
export function stepSegments(
  text: string,
  dish: Pick<DishResponse, 'ingredients' | 'baseServings'>,
  servings: number,
): StepSegment[] {
  const ingredients = new Map(dish.ingredients.map((item) => [item.key, item]));
  return splitStepText(text).flatMap((part): StepSegment[] => {
    if (part.kind === 'text') return [{ kind: 'text', text: part.text }];
    const ingredient = ingredients.get(part.key);
    if (!ingredient) return [];
    return [
      {
        kind: 'amount',
        text: formatAmount(amountFor(ingredient, dish, servings), ingredient.unit),
      },
    ];
  });
}
