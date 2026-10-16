import { describe, expect, it } from 'vitest';

import { DEFAULT_REMINDER_TIME, REMINDER_TIMES } from './constants.ts';
import { applyProfilePatch, changesPreferences, updateMeRequestSchema } from './me.ts';
import { reminderTimeSchema, type UserProfile } from './user.ts';

const profile: UserProfile = {
  id: 'u-1',
  tgId: 1002,
  firstName: 'Борис',
  username: 'boris_cook',
  photoUrl: null,
  household: 'couple',
  weekdayMinutes: 30,
  exclusions: ['meat'],
  customExclusions: ['кинза'],
  timezone: 'Europe/Moscow',
  reminderEnabled: false,
  reminderTime: '18:00',
  botCanWrite: true,
  inviteCode: 'inv1002',
};

describe('REMINDER_TIMES', () => {
  it('lists the whole day with a 30-minute step, every value valid for PATCH /me', () => {
    expect(REMINDER_TIMES).toHaveLength(48);
    expect(REMINDER_TIMES[0]).toBe('00:00');
    expect(REMINDER_TIMES[1]).toBe('00:30');
    expect(REMINDER_TIMES.at(-1)).toBe('23:30');
    expect(REMINDER_TIMES).toContain(DEFAULT_REMINDER_TIME);
    expect(new Set(REMINDER_TIMES).size).toBe(48);
    for (const time of REMINDER_TIMES) {
      expect(reminderTimeSchema.safeParse(time).success).toBe(true);
      expect(updateMeRequestSchema.safeParse({ reminderTime: time }).success).toBe(true);
    }
  });
});

describe('applyProfilePatch', () => {
  it('replaces only the sent fields', () => {
    expect(applyProfilePatch(profile, { household: 'family' })).toEqual({
      ...profile,
      household: 'family',
    });
    expect(
      applyProfilePatch(profile, {
        reminderEnabled: true,
        reminderTime: '19:30',
        timezone: 'Asia/Tbilisi',
      }),
    ).toEqual({
      ...profile,
      reminderEnabled: true,
      reminderTime: '19:30',
      timezone: 'Asia/Tbilisi',
    });
  });

  it('turns a reminder off (false is a value, not a missing field)', () => {
    const on = { ...profile, reminderEnabled: true };
    expect(applyProfilePatch(on, { reminderEnabled: false }).reminderEnabled).toBe(false);
  });

  it('stores both kinds of exclusions normalised, and can empty them', () => {
    const next = applyProfilePatch(profile, {
      exclusions: ['gluten', 'meat'],
      customExclusions: ['  Грибы ', 'КИНЗА'],
    });
    expect(next.exclusions).toEqual(['meat', 'gluten']);
    expect(next.customExclusions).toEqual(['грибы', 'кинза']);
    expect(applyProfilePatch(profile, { exclusions: [], customExclusions: [] })).toMatchObject({
      exclusions: [],
      customExclusions: [],
    });
  });

  it('does not touch fields the client cannot change', () => {
    const next = applyProfilePatch(profile, { weekdayMinutes: 45 });
    expect(next.botCanWrite).toBe(profile.botCanWrite);
    expect(next.inviteCode).toBe(profile.inviteCode);
    expect(next.firstName).toBe(profile.firstName);
  });
});

describe('changesPreferences', () => {
  it('is true for the onboarding answers', () => {
    expect(changesPreferences({ household: 'solo' })).toBe(true);
    expect(changesPreferences({ weekdayMinutes: 20 })).toBe(true);
    expect(changesPreferences({ exclusions: [] })).toBe(true);
    expect(changesPreferences({ customExclusions: ['грибы'] })).toBe(true);
  });

  it('is false for reminders and the time zone', () => {
    expect(changesPreferences({ reminderEnabled: true })).toBe(false);
    expect(changesPreferences({ reminderTime: '19:00', timezone: 'Europe/Moscow' })).toBe(false);
  });
});
