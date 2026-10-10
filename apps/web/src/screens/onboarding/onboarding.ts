import {
  isIanaTimeZone,
  normalizeCustomExclusions,
  normalizeExclusions,
  type DishTag,
  type Household,
  type UpdateMeRequest,
  type WeekdayMinutes,
} from '@tma80/shared';

/** Onboarding questions in order. */
export const ONBOARDING_STEPS = ['household', 'weekdayMinutes', 'exclusions'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Answers being collected; `step` is the index in `ONBOARDING_STEPS`. */
export interface OnboardingDraft {
  step: number;
  household: Household | null;
  weekdayMinutes: WeekdayMinutes | null;
  exclusions: DishTag[];
  /** Own exclusions («Своё»), as added in the field. */
  customExclusions: string[];
}

export const stepAt = (index: number): OnboardingStep =>
  ONBOARDING_STEPS[Math.min(Math.max(index, 0), ONBOARDING_STEPS.length - 1)] ?? 'household';

export const isLastStep = (index: number): boolean => index >= ONBOARDING_STEPS.length - 1;

/** Steps 1–2 need an answer; step 3 (what you do not eat) may stay empty. */
export function canProceed(draft: OnboardingDraft): boolean {
  switch (stepAt(draft.step)) {
    case 'household':
      return draft.household !== null;
    case 'weekdayMinutes':
      return draft.weekdayMinutes !== null;
    case 'exclusions':
      return true;
  }
}

/**
 * Body of `PATCH /me` for the finished onboarding, or `null` while a required answer is missing.
 * Both kinds of exclusions are sent normalised; the time zone is sent if the browser knows it.
 */
export function buildOnboardingRequest(
  draft: OnboardingDraft,
  timezone: string | undefined,
): UpdateMeRequest | null {
  if (draft.household === null || draft.weekdayMinutes === null) return null;
  return {
    household: draft.household,
    weekdayMinutes: draft.weekdayMinutes,
    exclusions: normalizeExclusions(draft.exclusions),
    customExclusions: normalizeCustomExclusions(draft.customExclusions),
    ...(timezone ? { timezone } : {}),
  };
}

/**
 * IANA time zone of the device, e.g. `Europe/Moscow`; `undefined` if unavailable or not a valid
 * zone name (some WebViews report an offset or garbage). An invalid value would make the server
 * reject `PATCH /me` with 400 on every retry and lock the user in onboarding, so it is not sent.
 */
export function detectTimeZone(): string | undefined {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isIanaTimeZone(timeZone) ? timeZone : undefined;
  } catch {
    return undefined;
  }
}
