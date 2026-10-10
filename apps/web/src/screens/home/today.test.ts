import { describe, expect, it } from 'vitest';

import { formatToday, initials } from './today.ts';

describe('formatToday', () => {
  it('formats the day in the user time zone, capitalised', () => {
    const now = new Date('2026-10-08T22:30:00Z');
    expect(formatToday(now, 'UTC')).toBe('Четверг, 8 октября');
    expect(formatToday(now, 'Europe/Moscow')).toBe('Пятница, 9 октября');
    expect(formatToday(now, 'Not/AZone')).toMatch(/^[А-Я]/u);
  });
});

describe('initials', () => {
  it('takes the first letter', () => {
    expect(initials(' борис')).toBe('Б');
    expect(initials('')).toBe('?');
  });
});
