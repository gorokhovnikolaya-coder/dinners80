import { describe, expect, it } from 'vitest';

import { toggleExclusion } from './exclusions.ts';

describe('toggleExclusion', () => {
  it('adds and removes tags in a stable order', () => {
    expect(toggleExclusion([], 'gluten', true)).toEqual(['gluten']);
    expect(toggleExclusion(['gluten'], 'meat', true)).toEqual(['meat', 'gluten']);
    expect(toggleExclusion(['meat', 'gluten'], 'gluten', false)).toEqual(['meat']);
    expect(toggleExclusion(['meat'], 'meat', true)).toEqual(['meat']);
  });
});
