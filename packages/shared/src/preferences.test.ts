import { describe, expect, it } from 'vitest';

import { meResponseSchema, updateMeRequestSchema } from './me.ts';
import {
  addCustomExclusion,
  cleanCustomExclusion,
  customExclusionKey,
  hasOnboardingAnswers,
  matchesCustomExclusion,
  normalizeCustomExclusions,
  normalizeExclusions,
} from './preferences.ts';
import {
  customExclusionsSchema,
  isIanaTimeZone,
  timezoneNameSchema,
  timezoneSchema,
  userProfileSchema,
} from './user.ts';

describe('normalizeExclusions', () => {
  it('sorts and de-duplicates the tags', () => {
    expect(normalizeExclusions(['gluten', 'meat', 'gluten'])).toEqual(['meat', 'gluten']);
    expect(normalizeExclusions([])).toEqual([]);
  });
});

describe('cleanCustomExclusion / customExclusionKey', () => {
  it('trims, collapses spaces and lower-cases; the key also maps ё to е', () => {
    expect(cleanCustomExclusion('  Сыр   Фета \t')).toBe('сыр фета');
    expect(cleanCustomExclusion('Свёкла')).toBe('свёкла');
    expect(customExclusionKey(' СВЁКЛА ')).toBe('свекла');
  });
});

describe('normalizeCustomExclusions', () => {
  it('cleans, drops invalid words and repeats (ё = е), keeps the first spelling', () => {
    expect(
      normalizeCustomExclusions([' Кинза ', 'свёкла', 'Свекла', 'к', '  ', '123', 'КИНЗА']),
    ).toEqual(['кинза', 'свёкла']);
  });

  it('keeps at most 10 words', () => {
    const words = Array.from({ length: 12 }, (_, i) => `слово${String(i)}`);
    expect(normalizeCustomExclusions(words)).toEqual(words.slice(0, 10));
  });
});

describe('addCustomExclusion', () => {
  it('adds a cleaned word', () => {
    expect(addCustomExclusion(['кинза'], '  Грибы ')).toEqual({ list: ['кинза', 'грибы'] });
  });

  it('explains why a word cannot be added', () => {
    expect(addCustomExclusion([], '   ')).toEqual({ error: 'empty' });
    expect(addCustomExclusion([], ' а ')).toEqual({ error: 'tooShort' });
    expect(addCustomExclusion([], 'а'.repeat(41))).toEqual({ error: 'tooLong' });
    expect(addCustomExclusion([], '42')).toEqual({ error: 'noLetter' });
    expect(addCustomExclusion(['свёкла'], 'СВЕКЛА')).toEqual({ error: 'duplicate' });
    const full = Array.from({ length: 10 }, (_, i) => `слово${String(i)}`);
    expect(addCustomExclusion(full, 'грибы')).toEqual({ error: 'limit' });
  });

  it('accepts the boundary lengths', () => {
    expect(addCustomExclusion([], 'ум')).toEqual({ list: ['ум'] });
    expect(addCustomExclusion([], 'а'.repeat(40))).toEqual({ list: ['а'.repeat(40)] });
  });
});

describe('matchesCustomExclusion', () => {
  const dish = {
    title: 'Борщ со Свёклой',
    ingredients: [{ name: 'Говядина на кости' }, { name: 'Кинза  свежая' }, { name: 'Сметана' }],
  };

  it('finds a word in the title or an ingredient name, as a substring', () => {
    expect(matchesCustomExclusion(dish, ['борщ'])).toBe(true);
    expect(matchesCustomExclusion(dish, ['кинз'])).toBe(true);
    expect(matchesCustomExclusion(dish, ['говядин'])).toBe(true);
    expect(matchesCustomExclusion(dish, ['грибы', 'сметана'])).toBe(true);
  });

  it('ignores case, ё/е and extra spaces', () => {
    expect(matchesCustomExclusion(dish, ['  СВЕКЛ '])).toBe(true);
    expect(matchesCustomExclusion(dish, ['кинза свежая'])).toBe(true);
    expect(matchesCustomExclusion({ title: 'Свекольник', ingredients: [] }, ['свёкол'])).toBe(true);
  });

  it('does not match other dishes or an empty list', () => {
    expect(matchesCustomExclusion(dish, ['грибы', 'свинина'])).toBe(false);
    expect(matchesCustomExclusion(dish, [])).toBe(false);
    expect(matchesCustomExclusion(dish, ['  '])).toBe(false);
  });
});

describe('customExclusionsSchema', () => {
  it('accepts up to 10 valid words without repeats', () => {
    expect(customExclusionsSchema.safeParse([]).success).toBe(true);
    expect(customExclusionsSchema.safeParse(['кинза', ' Грибы ']).success).toBe(true);
    const ten = Array.from({ length: 10 }, (_, i) => `слово${String(i)}`);
    expect(customExclusionsSchema.safeParse(ten).success).toBe(true);
  });

  it('rejects too many, too short, too long, letterless and repeated words', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `слово${String(i)}`);
    expect(customExclusionsSchema.safeParse(eleven).success).toBe(false);
    expect(customExclusionsSchema.safeParse(['к']).success).toBe(false);
    expect(customExclusionsSchema.safeParse(['а'.repeat(41)]).success).toBe(false);
    expect(customExclusionsSchema.safeParse([' '.repeat(99) + 'кинза']).success).toBe(false);
    expect(customExclusionsSchema.safeParse(['12']).success).toBe(false);
    expect(customExclusionsSchema.safeParse(['свёкла', 'Свекла']).success).toBe(false);
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
      customExclusions: ['кинза'],
      timezone: 'Asia/Yekaterinburg',
    };
    expect(updateMeRequestSchema.parse(body)).toEqual(body);
  });

  it('accepts a partial update (reminders from the profile)', () => {
    expect(updateMeRequestSchema.safeParse({ reminderEnabled: true }).success).toBe(true);
    expect(updateMeRequestSchema.safeParse({ reminderTime: '19:30' }).success).toBe(true);
    expect(updateMeRequestSchema.safeParse({ exclusions: [] }).success).toBe(true);
    expect(updateMeRequestSchema.safeParse({ customExclusions: [] }).success).toBe(true);
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
    expect(updateMeRequestSchema.safeParse({ exclusions: ['pork'] }).success).toBe(false);
    expect(updateMeRequestSchema.safeParse({ customExclusions: ['к'] }).success).toBe(false);
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
