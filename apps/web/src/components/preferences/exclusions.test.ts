import { describe, expect, it } from 'vitest';

import { exclusionOptions, toggleExclusion } from './exclusions.ts';

const stateOf = (selection: Parameters<typeof exclusionOptions>[0], tag: string) =>
  exclusionOptions(selection).find((option) => option.tag === tag);

describe('exclusionOptions', () => {
  it('nothing is checked by default', () => {
    expect(exclusionOptions([]).every((option) => !option.checked && !option.implied)).toBe(true);
  });

  it('meat checks and locks pork', () => {
    expect(stateOf(['meat'], 'pork')).toEqual({ tag: 'pork', checked: true, implied: true });
    expect(stateOf(['meat'], 'meat')).toEqual({ tag: 'meat', checked: true, implied: false });
  });

  it('pork alone is a normal choice', () => {
    expect(stateOf(['pork'], 'pork')).toEqual({ tag: 'pork', checked: true, implied: false });
    expect(stateOf(['pork'], 'meat')).toEqual({ tag: 'meat', checked: false, implied: false });
  });
});

describe('toggleExclusion', () => {
  it('adds and removes tags in a stable order', () => {
    expect(toggleExclusion([], 'gluten', true)).toEqual(['gluten']);
    expect(toggleExclusion(['gluten'], 'pork', true)).toEqual(['pork', 'gluten']);
    expect(toggleExclusion(['pork', 'gluten'], 'gluten', false)).toEqual(['pork']);
    expect(toggleExclusion(['pork'], 'pork', true)).toEqual(['pork']);
  });

  it('remembers pork under meat: unchecking meat brings the own choice back', () => {
    const withMeat = toggleExclusion(['pork'], 'meat', true);
    expect(stateOf(withMeat, 'pork')?.implied).toBe(true);
    const withoutMeat = toggleExclusion(withMeat, 'meat', false);
    expect(stateOf(withoutMeat, 'pork')).toEqual({ tag: 'pork', checked: true, implied: false });
    // Without an own choice pork goes back to unchecked.
    expect(stateOf(toggleExclusion(['meat'], 'meat', false), 'pork')?.checked).toBe(false);
  });
});
