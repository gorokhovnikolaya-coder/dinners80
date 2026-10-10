import { describe, expect, it } from 'vitest';

import { findStepPlaceholderProblems, splitStepText, stepPlaceholderKeys } from './steps.ts';

describe('splitStepText', () => {
  it('splits text and placeholders in order', () => {
    expect(splitStepText('Обжарьте {beef} говядины с {onion} лука.')).toEqual([
      { kind: 'text', text: 'Обжарьте ' },
      { kind: 'ingredient', key: 'beef' },
      { kind: 'text', text: ' говядины с ' },
      { kind: 'ingredient', key: 'onion' },
      { kind: 'text', text: ' лука.' },
    ]);
  });

  it('handles placeholders at the edges and next to each other', () => {
    expect(splitStepText('{a}{b_2}')).toEqual([
      { kind: 'ingredient', key: 'a' },
      { kind: 'ingredient', key: 'b_2' },
    ]);
  });

  it('keeps a text without placeholders and braces that are not keys', () => {
    expect(splitStepText('Запекайте при 180 °C.')).toEqual([
      { kind: 'text', text: 'Запекайте при 180 °C.' },
    ]);
    expect(splitStepText('Скобки {Не ключ} остаются')).toEqual([
      { kind: 'text', text: 'Скобки {Не ключ} остаются' },
    ]);
    expect(splitStepText('')).toEqual([]);
  });
});

describe('stepPlaceholderKeys', () => {
  it('lists keys with repeats', () => {
    expect(stepPlaceholderKeys('{a} и {b}, потом снова {a}')).toEqual(['a', 'b', 'a']);
  });
});

describe('findStepPlaceholderProblems', () => {
  const ingredients = [
    { key: 'beef', amount: 400 },
    { key: 'salt', amount: null },
  ];

  it('accepts known keys with amounts', () => {
    expect(
      findStepPlaceholderProblems(ingredients, [{ text: 'Обжарьте {beef} говядины.' }]),
    ).toEqual([]);
  });

  it('reports unknown keys and «по вкусу» ingredients with the step number', () => {
    expect(
      findStepPlaceholderProblems(ingredients, [
        { text: 'Нарежьте {beef} говядины.' },
        { text: 'Добавьте {onion} лука и {salt}.' },
      ]),
    ).toEqual([
      { step: 2, key: 'onion', reason: 'unknownKey' },
      { step: 2, key: 'salt', reason: 'toTaste' },
    ]);
  });
});
