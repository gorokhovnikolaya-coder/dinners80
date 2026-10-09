import { describe, expect, it } from 'vitest';

import { normalizeProgress } from './progress.ts';

describe('normalizeProgress', () => {
  it('computes the ratio inside the range', () => {
    expect(normalizeProgress(8, 30)).toEqual({ value: 8, max: 30, ratio: 8 / 30 });
  });

  it('keeps the bounds', () => {
    expect(normalizeProgress(0, 30).ratio).toBe(0);
    expect(normalizeProgress(30, 30).ratio).toBe(1);
  });

  it('clamps values outside [0, max]', () => {
    expect(normalizeProgress(-5, 30)).toEqual({ value: 0, max: 30, ratio: 0 });
    expect(normalizeProgress(45, 30)).toEqual({ value: 30, max: 30, ratio: 1 });
  });

  it('treats a non-positive or non-finite max as an empty scale', () => {
    expect(normalizeProgress(5, 0)).toEqual({ value: 0, max: 0, ratio: 0 });
    expect(normalizeProgress(5, -1)).toEqual({ value: 0, max: 0, ratio: 0 });
    expect(normalizeProgress(5, Number.NaN)).toEqual({ value: 0, max: 0, ratio: 0 });
  });

  it('treats a non-finite value as zero', () => {
    expect(normalizeProgress(Number.NaN, 30).value).toBe(0);
    expect(normalizeProgress(Number.POSITIVE_INFINITY, 30).value).toBe(0);
  });
});
