import {
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
  /** Raw selection (may hold pork together with meat; normalised only when saving). */
  exclusions: DishTag[];
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
 * Exclusions are normalised (pork is dropped when meat is excluded); the time zone is sent if the
 * browser knows it.
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
    ...(timezone ? { timezone } : {}),
  };
}

/** IANA time zone of the device, e.g. `Europe/Moscow`; `undefined` if unavailable. */
export function detectTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
