import { useCallback, useEffect, useId, useRef } from 'react';

import { useUpdateMeMutation } from '../../api/me.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { IconAlert } from '../../components/icons.tsx';
import {
  ExclusionsField,
  HouseholdField,
  WeekdayMinutesField,
} from '../../components/preferences/PreferenceFields.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import {
  buildOnboardingRequest,
  canProceed,
  detectTimeZone,
  isLastStep,
  ONBOARDING_STEPS,
  stepAt,
} from './onboarding.ts';
import {
  exclusionsChanged,
  householdSelected,
  reset,
  selectDraft,
  stepBack,
  stepForward,
  weekdayMinutesSelected,
} from './onboardingSlice.ts';

const t = ru.onboarding;

/**
 * «Онбординг»: three questions (who eats, weekday dinner time, what you do not eat), saved with
 * `PATCH /me` after the last one. Shown while `needsOnboarding`; once the save succeeds the cached
 * auth result switches the app to «Ужин сегодня». Back between questions — the Telegram
 * BackButton (steps 2–3).
 */
export default function OnboardingScreen() {
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectDraft);
  const [updateMe, { isLoading: saving, isError: saveFailed, reset: resetSave }] =
    useUpdateMeMutation();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const step = stepAt(draft.step);
  const last = isLastStep(draft.step);
  const texts = t.steps[step];

  const goBack = useCallback(() => {
    resetSave();
    dispatch(stepBack());
  }, [dispatch, resetSave]);
  const onBack = draft.step > 0 && !saving ? goBack : undefined;

  // The draft lives only while the screen is shown: after a successful save it unmounts.
  useEffect(
    () => () => {
      dispatch(reset());
    },
    [dispatch],
  );

  // Move focus to the new question so screen readers announce it (not on the first render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [draft.step]);

  const next = () => {
    if (!canProceed(draft) || saving) return;
    if (!last) {
      dispatch(stepForward());
      return;
    }
    const body = buildOnboardingRequest(draft, detectTimeZone());
    if (body) void updateMe(body);
  };

  return (
    <main className="flex min-h-dvh flex-col gap-7 bg-bg px-5 pt-14 pb-safe-8 text-ink">
      <div className="flex items-center gap-3">
        {/* Telegram BackButton on steps 2–3; an in-page button only if the client lacks it. */}
        <BackNavigation onBack={onBack} />
        <ProgressBar
          variant="steps"
          size="xs"
          value={draft.step + 1}
          max={ONBOARDING_STEPS.length}
          label={t.progress}
          valueText={t.counter(draft.step + 1, ONBOARDING_STEPS.length)}
          className="flex-1"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold tracking-caps-lg text-primary uppercase">
          {t.counter(draft.step + 1, ONBOARDING_STEPS.length)}
        </p>
        <h1
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="font-display text-8xl font-bold focus-visible:outline-none"
        >
          {texts.title}
        </h1>
        <p className="text-base text-ink-2">{texts.description}</p>
      </div>

      {step === 'household' && (
        <HouseholdField
          value={draft.household}
          onChange={(value) => dispatch(householdSelected(value))}
          labelledBy={titleId}
        />
      )}
      {step === 'weekdayMinutes' && (
        <WeekdayMinutesField
          value={draft.weekdayMinutes}
          onChange={(value) => dispatch(weekdayMinutesSelected(value))}
          labelledBy={titleId}
        />
      )}
      {step === 'exclusions' && (
        <ExclusionsField
          value={{ exclusions: draft.exclusions, customExclusions: draft.customExclusions }}
          onChange={(value) => {
            resetSave();
            dispatch(exclusionsChanged(value));
          }}
          labelledBy={titleId}
          disabled={saving}
        />
      )}

      <div className="mt-auto flex flex-col gap-3">
        {saveFailed ? (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 text-md font-semibold text-accent-strong"
          >
            <IconAlert size={20} />
            {t.saveError} {ru.common.errorHint}
          </p>
        ) : (
          <p className="text-center text-sm text-muted">{texts.hint}</p>
        )}
        {/* While saving the button stays focusable (aria-disabled) and shows progress. */}
        <Button
          variant="accent"
          size="lg"
          fullWidth
          disabled={!canProceed(draft)}
          loading={saving}
          onClick={next}
        >
          {saving ? t.saving : saveFailed ? t.retry : t.next}
        </Button>
      </div>
    </main>
  );
}
