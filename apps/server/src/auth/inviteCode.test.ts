import { describe, expect, it } from 'vitest';

import { generateInviteCode, INVITE_CODE_LENGTH } from './inviteCode.ts';

describe('generateInviteCode', () => {
  it('returns random alphanumeric codes', () => {
    const codes = Array.from({ length: 200 }, generateInviteCode);
    for (const code of codes)
      expect(code).toMatch(new RegExp(`^[A-Za-z0-9]{${String(INVITE_CODE_LENGTH)}}$`));
    expect(new Set(codes).size).toBe(codes.length);
  });
});
