import { describe, expect, it } from 'vitest';

import { meResponseSchema, updateMeRequestSchema } from './me.ts';
import { hasOnboardingAnswers, isExclusionImplied, normalizeExclusions } from './preferences.ts';
import { isIanaTimeZone, timezoneNameSchema, timezoneSchema, userProfileSchema } from './user.ts';

describe('isExclusionImplied', () => {
  it('treats pork as excluded when meat is excluded', () => {
    expect(isExclusionImplied('pork', ['meat'])).toBe(true);
    expect(isExclusionImplied('pork', ['pork', 'meat'])).toBe(true);
  });

  it('does not imply anything else', () => {
    expect(isExclusionImplied('pork', [])).toBe(false);
    expect(isExclusionImplied('pork', ['pork'])).toBe(false);
    expect(isExclusionImplied('meat', ['pork'])).toBe(false);
    expect(isExclusionImplied('spicy', ['meat', 'gluten'])).toBe(false);
    expect(isExclusionImplied('meat', ['meat'])).toBe(false);
  });
});

describe('normalizeExclusions', () => {
  it('drops pork when meat is excluded', () => {
    expect(normalizeExclusions(['pork', 'meat'])).toEqual(['meat']);
    expect(normalizeExclusions(['meat', 'pork', 'spicy'])).toEqual(['meat', 'spicy']);
  });

  it('keeps pork alone and sorts and de-duplicates the tags', () => {
    expect(normalizeExclusions(['gluten', 'pork', 'gluten'])).toEqual(['pork', 'gluten']);
    expect(normalizeExclusions([])).toEqual([]);
  });
});

describe('hasOnboardingAnswers', () => {
  it('needs both who eats and the weekday time', () => {
    expect(hasOnboardingAnswers({ household: 'couple', weekdayMinutes: 30 })).toBe(true);
    expect(hasOnboardingAnswers({ household: null, weekdayMinutes: 30 })).toBe(false);
    expect(hasOnboardingAnswers({ household: 'solo', weekdayMinutes: null })).toBe(false);
  });
});

describe('updateMeRequestSchema', () => {
  it('accepts onboarding answers with a time zone', () => {
    const body = {
      household: 'family',
      weekdayMinutes: 45,
      exclusions: ['meat', 'gluten'],
      timezone: 'Asia/Yekaterinburg',
    };
    expect(updateMeRequestSchema.parse(body)).toEqual(body);
  });

  it('accepts a partial update (reminders from the profile)', () => {
    expect(updateMeRequestSchema.safeParse({ reminderEnabled: true }).success).toBe(true);
    expect(updateMeRequestSchema.safeParse({ reminderTime: '19:30' }).success).toBe(true);
    expect(updateMeRequestSchema.safeParse({ exclusions: [] }).success).toBe(true);
  });

  it('rejects an empty update, unknown fields and invalid values', () => {
    expect(updateMeRequestSchema.safeParse({}).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ household: 'solo', onboardedAt: 'x' }).success).toBe(
      false,
    );
    expect(updateMeRequestSchema.safeParse({ household: 'crowd' }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ weekdayMinutes: 25 }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ exclusions: ['fish'] }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ exclusions: ['meat', 'meat'] }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ timezone: '' }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ reminderTime: '18:15' }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ household: null }).success).toBe(false);
  });
});

describe('timezoneSchema', () => {
  it('accepts IANA zone names', () => {
    for (const zone of [
      'Europe/Moscow',
      'Asia/Yekaterinburg',
      'America/Argentina/Buenos_Aires',
      'UTC',
    ]) {
      expect(timezoneSchema.safeParse(zone).success).toBe(true);
    }
  });

  it('rejects unknown zones, offsets and garbage', () => {
    for (const zone of ['foo', 'Europe/Atlantis', '+03:00', 'Europe/Moscow ', '', '../etc']) {
      expect(timezoneSchema.safeParse(zone).success).toBe(false);
    }
    expect(isIanaTimeZone('foo')).toBe(false);
    expect(updateMeRequestSchema.safeParse({ timezone: 'foo' }).success).toBe(false);
  });
});

describe('timezoneNameSchema (profile in responses)', () => {
  it('checks only the format, not the runtime ICU data', () => {
    // A zone this runtime's Intl does not know (or a newer one, unknown to an old WebView) must not
    // break parsing of `POST /auth` and `PATCH /me` responses on the client.
    expect(isIanaTimeZone('Europe/Atlantis')).toBe(false);
    expect(timezoneNameSchema.safeParse('Europe/Atlantis').success).toBe(true);
    expect(timezoneNameSchema.safeParse('Europe/Kyiv').success).toBe(true);
    expect(userProfileSchema.shape.timezone.safeParse('Europe/Atlantis').success).toBe(true);
  });

  it('rejects empty, too long and malformed values', () => {
    for (const zone of ['', 'a'.repeat(65), '+03:00', 'Europe/Moscow ', '../etc', 'Europe//X']) {
      expect(timezoneNameSchema.safeParse(zone).success).toBe(false);
    }
  });
});

describe('meResponseSchema', () => {
  it('requires the profile and the onboarding flag', () => {
    expect(meResponseSchema.safeParse({ needsOnboarding: false }).success).toBe(false);
  });
});
