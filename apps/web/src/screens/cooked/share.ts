import { STORY_TEXT_MAX, type CreateCookResponse, type DishResponse } from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';

const t = ru.cooked;

/** What the share card and the share texts say about the cook. */
export interface ShareSubject {
  dish: Pick<DishResponse, 'title' | 'countryName'>;
  result: Pick<CreateCookResponse, 'newCountry' | 'countriesCount' | 'countriesTotal'>;
}

/** «Перу в паспорте» for a new country, «Ломо сальтадо — блюдо засчитано» for a repeat. */
export function shareHeadline({ dish, result }: ShareSubject): string {
  return result.newCountry ? t.inPassport(dish.countryName) : t.share.repeatHeadline(dish.title);
}

/**
 * The story caption with the invite link (a regular user may post at most `STORY_TEXT_MAX`
 * characters, so a too long one loses the headline, then everything but the link).
 */
export function storyCaption(subject: ShareSubject, link: string): string {
  const { countriesCount, countriesTotal } = subject.result;
  const counter = t.countries(countriesCount, countriesTotal);
  const options = [
    t.share.storyText(shareHeadline(subject), counter, link),
    t.share.storyTextShort(link),
  ];
  return options.find((text) => text.length <= STORY_TEXT_MAX) ?? link;
}

/** The text of the `t.me/share/url` fallback; the invite link goes as its URL. */
export function shareFallbackText({ dish, result }: ShareSubject): string {
  return t.share.messageText(
    result.newCountry,
    dish.countryName,
    dish.title,
    t.countries(result.countriesCount, result.countriesTotal),
  );
}

/** Font size and lines of a text that has to fit a width on the card. */
export interface TextLayout {
  size: number;
  lines: string[];
}

/**
 * Fits a text into `maxWidth`: the largest size from `max` down to `min` (step 2) that keeps it on
 * one line; otherwise the `min` size, wrapped by words (a word longer than the width stays whole).
 * @param measure - width of the text at the font size (canvas `measureText`).
 */
export function layoutText(
  text: string,
  maxWidth: number,
  { max, min }: { max: number; min: number },
  measure: (text: string, size: number) => number,
): TextLayout {
  for (let size = max; size >= min; size -= 2) {
    if (measure(text, size) <= maxWidth) return { size, lines: [text] };
  }
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && measure(next, min) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return { size: min, lines };
}

/** The part of a `width × height` image that covers a square (`object-fit: cover`). */
export function coverSquare(
  width: number,
  height: number,
): {
  sx: number;
  sy: number;
  side: number;
} {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}
