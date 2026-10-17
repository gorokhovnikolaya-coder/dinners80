import { STORY_TEXT_MAX } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { coverSquare, layoutText, shareFallbackText, storyCaption } from './share.ts';

const LINK = 'https://t.me/tma80_bot/app?startapp=abcdefgh1234';
const subject = (newCountry: boolean, countryName = 'Перу', title = 'Ломо сальтадо') => ({
  dish: { title, countryName },
  result: { newCountry, countriesCount: 8, countriesTotal: 30 },
});

describe('storyCaption', () => {
  it('says the headline, the counter and the invite link', () => {
    expect(storyCaption(subject(true), LINK)).toBe(
      `Перу в паспорте! 8 из 30 стран. Собираю штампы за ужинами — присоединяйся: ${LINK}`,
    );
    expect(storyCaption(subject(false), LINK)).toBe(
      `Ломо сальтадо — блюдо засчитано! 8 из 30 стран. Собираю штампы за ужинами — присоединяйся: ${LINK}`,
    );
  });

  it('fits the caption limit of a regular user, keeping the link', () => {
    const long = storyCaption(subject(false, 'Перу', 'Очень '.repeat(30)), LINK);
    expect(long.length).toBeLessThanOrEqual(STORY_TEXT_MAX);
    expect(long).toBe(`Собираю штампы за ужинами — присоединяйся: ${LINK}`);
    const longest = storyCaption(subject(true, 'Новая Зеландия'), LINK);
    expect(longest.length).toBeLessThanOrEqual(STORY_TEXT_MAX);
    expect(longest).toMatch(/^Новая Зеландия в паспорте!/);
  });
});

describe('shareFallbackText', () => {
  it('says the same as the server share message', () => {
    expect(shareFallbackText(subject(true))).toBe(
      'Перу в паспорте — уже 8 из 30 стран! Готовлю ужины из кухонь разных стран и собираю ' +
        'штампы. Присоединяйся — посоревнуемся!',
    );
    expect(shareFallbackText(subject(false))).toMatch(
      /^Ломо сальтадо — блюдо засчитано, уже 8 из 30 стран! Готовлю/,
    );
  });
});

describe('layoutText', () => {
  // Every character is `size / 2` wide.
  const measure = (text: string, size: number) => (text.length * size) / 2;

  it('takes the largest size that keeps one line', () => {
    expect(layoutText('Перу в паспорте', 800, { max: 96, min: 64 }, measure)).toEqual({
      size: 96,
      lines: ['Перу в паспорте'],
    });
    // 25 characters: 25 × 64 / 2 = 800.
    expect(layoutText('Новая Зеландия в паспорте', 800, { max: 96, min: 60 }, measure)).toEqual({
      size: 64,
      lines: ['Новая Зеландия в паспорте'],
    });
  });

  it('wraps by words at the smallest size', () => {
    expect(layoutText('Новая Зеландия в паспорте', 500, { max: 96, min: 64 }, measure)).toEqual({
      size: 64,
      lines: ['Новая Зеландия', 'в паспорте'],
    });
    expect(layoutText('Сверхдлинноеслово', 100, { max: 40, min: 30 }, measure).lines).toEqual([
      'Сверхдлинноеслово',
    ]);
  });
});

describe('coverSquare', () => {
  it('crops the middle square of a landscape or portrait photo', () => {
    expect(coverSquare(1600, 1200)).toEqual({ sx: 200, sy: 0, side: 1200 });
    expect(coverSquare(900, 1600)).toEqual({ sx: 0, sy: 350, side: 900 });
    expect(coverSquare(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 });
  });
});
