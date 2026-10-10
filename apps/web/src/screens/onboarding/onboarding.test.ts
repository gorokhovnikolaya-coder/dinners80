import { updateMeRequestSchema } from '@tma80/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildOnboardingRequest,
  canProceed,
  detectTimeZone,
  isLastStep,
  stepAt,
  type OnboardingDraft,
} from './onboarding.ts';
import {
  exclusionsChanged,
  householdSelected,
  onboardingSlice,
  reset,
  stepBack,
  stepForward,
  weekdayMinutesSelected,
} from './onboardingSlice.ts';

const empty: OnboardingDraft = { step: 0, household: null, weekdayMinutes: null, exclusions: [] };

describe('canProceed', () => {
  it('step 1 needs who eats', () => {
    expect(canProceed(empty)).toBe(false);
    expect(canProceed({ ...empty, household: 'family' })).toBe(true);
  });

  it('step 2 needs the weekday time', () => {
    expect(canProceed({ ...empty, step: 1, household: 'solo' })).toBe(false);
    expect(canProceed({ ...empty, step: 1, household: 'solo', weekdayMinutes: 45 })).toBe(true);
  });

  it('step 3 may stay empty', () => {
    expect(canProceed({ ...empty, step: 2, household: 'solo', weekdayMinutes: 20 })).toBe(true);
  });
});

describe('steps', () => {
  it('maps indices to questions and clamps out-of-range values', () => {
    expect([0, 1, 2].map(stepAt)).toEqual(['household', 'weekdayMinutes', 'exclusions']);
    expect(stepAt(-1)).toBe('household');
    expect(stepAt(7)).toBe('exclusions');
    expect([0, 1, 2].map(isLastStep)).toEqual([false, false, true]);
  });
});

describe('buildOnboardingRequest', () => {
  const answered: OnboardingDraft = {
    step: 2,
    household: 'couple',
    weekdayMinutes: 30,
    exclusions: ['gluten', 'pork', 'meat'],
  };

  it('sends normalised answers and the time zone', () => {
    const body = buildOnboardingRequest(answered, 'Europe/Kaliningrad');
    expect(body).toEqual({
      household: 'couple',
      weekdayMinutes: 30,
      exclusions: ['meat', 'gluten'],
      timezone: 'Europe/Kaliningrad',
    });
    expect(updateMeRequestSchema.safeParse(body).success).toBe(true);
  });

  it('sends an empty exclusion list and omits an unknown time zone', () => {
    expect(buildOnboardingRequest({ ...answered, exclusions: [] }, undefined)).toEqual({
      household: 'couple',
      weekdayMinutes: 30,
      exclusions: [],
    });
  });

  it('returns null while a required answer is missing', () => {
    expect(buildOnboardingRequest({ ...answered, household: null }, 'UTC')).toBeNull();
    expect(buildOnboardingRequest({ ...answered, weekdayMinutes: null }, 'UTC')).toBeNull();
  });
});

describe('detectTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the IANA zone from Intl', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Asia/Vladivostok',
    });
    expect(detectTimeZone()).toBe('Asia/Vladivostok');
  });

  it('drops a value that is not a valid IANA zone name', () => {
    for (const timeZone of ['+03:00', 'Europe/Atlantis', '', 'Etc/Unknown zone']) {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        ...new Intl.DateTimeFormat().resolvedOptions(),
        timeZone,
      });
      expect(detectTimeZone()).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('returns undefined when Intl fails', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(detectTimeZone()).toBeUndefined();
  });
});

describe('onboardingSlice', () => {
  const { reducer } = onboardingSlice;

  it('collects answers and keeps them when moving between steps', () => {
    let state = reducer(undefined, householdSelected('family'));
    state = reducer(state, stepForward());
    state = reducer(state, weekdayMinutesSelected(20));
    state = reducer(state, stepForward());
    state = reducer(state, exclusionsChanged(['spicy']));
    state = reducer(state, stepForward());
    expect(state).toEqual({
      step: 2,
      household: 'family',
      weekdayMinutes: 20,
      exclusions: ['spicy'],
    });

    state = reducer(state, stepBack());
    state = reducer(state, stepBack());
    state = reducer(state, stepBack());
    expect(state.step).toBe(0);
    expect(state.weekdayMinutes).toBe(20);

    expect(reducer(state, reset())).toEqual(empty);
  });
});
