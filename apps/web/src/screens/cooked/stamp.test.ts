import { describe, expect, it } from 'vitest';

import { stampCountryClass, stampDate } from './stamp.ts';

describe('stampDate', () => {
  it('formats the date in the user time zone', () => {
    const lateEvening = new Date('2026-10-08T22:30:00Z');
    expect(stampDate(lateEvening, 'Europe/Moscow')).toBe('09.10.2026');
    expect(stampDate(lateEvening, 'America/Lima')).toBe('08.10.2026');
  });

  it('falls back to the device zone for an unknown one', () => {
    expect(stampDate(new Date('2026-10-08T12:00:00Z'), 'Mars/Base')).toMatch(
      /^\d{2}\.\d{2}\.2026$/,
    );
  });
});

describe('stampCountryClass', () => {
  it('shrinks long country names', () => {
    expect(stampCountryClass('Перу')).toBe('text-5xl');
    expect(stampCountryClass('Индия')).toBe('text-2xl');
    expect(stampCountryClass('Таиланд')).toBe('text-lg');
    expect(stampCountryClass('Аргентина')).toBe('text-md');
    expect(stampCountryClass('Великобритания')).toBe('text-xs');
  });
});
