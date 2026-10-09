import { describe, expect, it } from 'vitest';

import { parseMockControls, takeFailure } from './controls.ts';

describe('mock controls', () => {
  it('fails once by default and always with :always', () => {
    const controls = parseMockControls('?user=1002&mock_error=auth,home:always');
    expect(takeFailure(controls, 'auth')).toBe(true);
    expect(takeFailure(controls, 'auth')).toBe(false);
    expect(takeFailure(controls, 'home')).toBe(true);
    expect(takeFailure(controls, 'home')).toBe(true);
    expect(takeFailure(controls, 'map')).toBe(false);
  });

  it('parses the delay and ignores junk', () => {
    expect(parseMockControls('?mock_delay=1500').delayMs).toBe(1500);
    expect(parseMockControls('?mock_delay=abc').delayMs).toBe(0);
    expect(parseMockControls('').failures.size).toBe(0);
  });
});
