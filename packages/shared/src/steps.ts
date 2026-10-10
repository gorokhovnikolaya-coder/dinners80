/**
 * Recipe step text (`dish_steps.text`) with `{key}` placeholders of the dish's ingredients.
 *
 * Content rule: a placeholder is replaced with the amount only («400 г»), so the author writes
 * the noun in the right case right after it: «Обжарьте {beef} говядины» → «Обжарьте 400 г
 * говядины». Ingredients «по вкусу» (no amount) have no placeholders.
 */

/** A piece of a step text: plain text or the placeholder of an ingredient. */
export type StepPart = { kind: 'text'; text: string } | { kind: 'ingredient'; key: string };

const PLACEHOLDER = /\{([a-z0-9_]+)\}/g;

/** Splits a step text into plain text and `{key}` placeholders, in order. */
export function splitStepText(text: string): StepPart[] {
  const parts: StepPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const [whole, key] = match;
    if (key === undefined) continue;
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    parts.push({ kind: 'ingredient', key });
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** Keys of the placeholders of a step text, in order (with repeats). */
export function stepPlaceholderKeys(text: string): string[] {
  return splitStepText(text).flatMap((part) => (part.kind === 'ingredient' ? [part.key] : []));
}

/** A placeholder the content must not have (the seed refuses such a dish, task 14). */
export interface StepPlaceholderProblem {
  /** Step number, from 1. */
  step: number;
  key: string;
  /** `unknownKey` — no such ingredient in the dish; `toTaste` — the ingredient has no amount. */
  reason: 'unknownKey' | 'toTaste';
}

/** Placeholders of the steps that point to an unknown ingredient or to one «по вкусу». */
export function findStepPlaceholderProblems(
  ingredients: readonly { key: string; amount: number | null }[],
  steps: readonly { text: string }[],
): StepPlaceholderProblem[] {
  const amounts = new Map(ingredients.map((item) => [item.key, item.amount]));
  return steps.flatMap((step, index) =>
    stepPlaceholderKeys(step.text).flatMap((key): StepPlaceholderProblem[] => {
      if (!amounts.has(key)) return [{ step: index + 1, key, reason: 'unknownKey' }];
      if (amounts.get(key) === null) return [{ step: index + 1, key, reason: 'toTaste' }];
      return [];
    }),
  );
}
