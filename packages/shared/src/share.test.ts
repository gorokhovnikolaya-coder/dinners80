import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import {
  absoluteMediaUrl,
  miniAppInviteLink,
  shareStampResponseSchema,
  uploadShareCardQuerySchema,
} from './share.ts';

describe('absoluteMediaUrl', () => {
  it('resolves a relative media URL against the origin of the domain', () => {
    expect(absoluteMediaUrl('/media/share/a.jpg', 'https://tma80.example')).toBe(
      'https://tma80.example/media/share/a.jpg',
    );
    expect(absoluteMediaUrl('/media/share/a.jpg', 'https://tma80.example/app/')).toBe(
      'https://tma80.example/media/share/a.jpg',
    );
  });

  it('keeps an absolute media URL', () => {
    expect(absoluteMediaUrl('https://cdn.example/share/a.jpg', 'https://tma80.example')).toBe(
      'https://cdn.example/share/a.jpg',
    );
  });
});

describe('miniAppInviteLink', () => {
  it('adds the invite code as startapp', () => {
    expect(miniAppInviteLink('https://t.me/tma80_bot/app', 'abc_123')).toBe(
      'https://t.me/tma80_bot/app?startapp=abc_123',
    );
  });
});

describe('share schemas', () => {
  it('accepts only a uuid cook id', () => {
    const cookId = '0b8f3f43-3c0c-4d43-9a0f-4b8a2f1f6c11';
    expect(z.safeParse(uploadShareCardQuerySchema, { cookId }).success).toBe(true);
    expect(z.safeParse(uploadShareCardQuerySchema, { cookId: '../x' }).success).toBe(false);
    expect(z.safeParse(uploadShareCardQuerySchema, {}).success).toBe(false);
  });

  it('needs a prepared message id', () => {
    expect(z.safeParse(shareStampResponseSchema, { preparedMessageId: 'x1' }).success).toBe(true);
    expect(z.safeParse(shareStampResponseSchema, { preparedMessageId: '' }).success).toBe(false);
  });
});
