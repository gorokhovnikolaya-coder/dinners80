import { describe, expect, it } from 'vitest';

import { authResponseSchema } from './auth.ts';
import { dishSchema } from './content.ts';
import { apiErrorSchema } from './errors.ts';

const profile = {
  id: 'u-1',
  tgId: 1001,
  firstName: 'Аня',
  username: null,
  photoUrl: null,
  household: null,
  weekdayMinutes: null,
  exclusions: [],
  customExclusions: [],
  timezone: 'Europe/Moscow',
  reminderEnabled: false,
  reminderTime: '18:00',
  botCanWrite: true,
  inviteCode: 'abc',
};

describe('authResponseSchema', () => {
  it('accepts a new user without onboarding answers', () => {
    const value = {
      user: profile,
      subscription: { active: false, plan: null, expiresAt: null },
      needsOnboarding: true,
    };
    expect(authResponseSchema.parse(value)).toEqual(value);
  });

  it('rejects unknown onboarding answers and malformed reminder time', () => {
    const base = {
      subscription: { active: false, plan: null, expiresAt: null },
      needsOnboarding: false,
    };
    expect(
      authResponseSchema.safeParse({ ...base, user: { ...profile, weekdayMinutes: 25 } }).success,
    ).toBe(false);
    expect(
      authResponseSchema.safeParse({ ...base, user: { ...profile, household: 'group' } }).success,
    ).toBe(false);
    expect(
      authResponseSchema.safeParse({ ...base, user: { ...profile, reminderTime: '18:15' } })
        .success,
    ).toBe(false);
  });
});

describe('dishSchema', () => {
  it('rejects unknown tags and levels', () => {
    const dish = {
      id: 'pe-ceviche',
      countryId: 'pe',
      slug: 'ceviche',
      title: 'Севиче',
      level: 'weekday',
      minutes: 25,
      baseServings: 2,
      description: '',
      fact: '',
      imagePath: 'pe/ceviche.webp',
      tags: ['spicy'],
    };
    expect(dishSchema.safeParse(dish).success).toBe(true);
    expect(dishSchema.safeParse({ ...dish, tags: ['fish'] }).success).toBe(false);
    expect(dishSchema.safeParse({ ...dish, level: 'easy' }).success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('accepts only known error codes', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'unauthorized', message: 'x' } }).success,
    ).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: 'teapot', message: 'x' } }).success).toBe(
      false,
    );
  });
});
