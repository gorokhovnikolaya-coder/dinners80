// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { readColorToken, toHexColor } from './tokens.ts';

describe('toHexColor', () => {
  it('accepts #RRGGBB in any case and with spaces', () => {
    expect(toHexColor(' #F3F5F7 ')).toBe('#f3f5f7');
  });

  it('expands #RGB', () => {
    expect(toHexColor('#fa0')).toBe('#ffaa00');
  });

  it('rejects other formats and an empty value', () => {
    expect(toHexColor('')).toBeUndefined();
    expect(toHexColor('rgb(0 0 0)')).toBeUndefined();
    expect(toHexColor('#f3f5f7aa')).toBeUndefined();
    expect(toHexColor('oklch(0.9 0 0)')).toBeUndefined();
  });
});

describe('readColorToken', () => {
  it('reads a CSS variable from the root element', () => {
    document.documentElement.style.setProperty('--color-bg', '#F3F5F7');
    expect(readColorToken('--color-bg')).toBe('#f3f5f7');
    document.documentElement.style.removeProperty('--color-bg');
    expect(readColorToken('--color-bg')).toBeUndefined();
  });
});
