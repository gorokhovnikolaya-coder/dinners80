import { describe, expect, it } from 'vitest';

import { missingPhotosMessage } from './seed.ts';

describe('missingPhotosMessage', () => {
  it('is null when every photo is in place', () => {
    expect(missingPhotosMessage([], 90)).toBeNull();
  });

  it('names up to three missing photos', () => {
    expect(missingPhotosMessage(['it/a.webp', 'it/b.webp'], 90)).toBe(
      '2 of 90 dish photos are missing in content/ (it/a.webp, it/b.webp)',
    );
    expect(missingPhotosMessage(['a', 'b', 'c', 'd'], 90)).toBe(
      '4 of 90 dish photos are missing in content/ (a, b, c, …)',
    );
  });
});
