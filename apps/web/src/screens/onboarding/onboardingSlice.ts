import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import type { DishTag, Household, WeekdayMinutes } from '@tma80/shared';

import { rootReducer } from '../../store/store.ts';
import { ONBOARDING_STEPS, type OnboardingDraft } from './onboarding.ts';

const initialState: OnboardingDraft = {
  step: 0,
  household: null,
  weekdayMinutes: null,
  exclusions: [],
};

/**
 * Draft answers of the onboarding. Kept in Redux (client state, decision 0001) so they survive
 * a failed save and re-renders; reset when the screen unmounts after a successful save.
 * `exclusions` is the raw selection: pork stays remembered while meat implies it.
 */
export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    householdSelected(state, action: PayloadAction<Household>) {
      state.household = action.payload;
    },
    weekdayMinutesSelected(state, action: PayloadAction<WeekdayMinutes>) {
      state.weekdayMinutes = action.payload;
    },
    exclusionsChanged(state, action: PayloadAction<DishTag[]>) {
      state.exclusions = action.payload;
    },
    stepForward(state) {
      state.step = Math.min(state.step + 1, ONBOARDING_STEPS.length - 1);
    },
    stepBack(state) {
      state.step = Math.max(state.step - 1, 0);
    },
    reset: () => initialState,
  },
  selectors: {
    selectDraft: (state) => state,
  },
});

declare module '../../store/store.ts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy slice augmentation
  export interface LazyLoadedSlices extends WithSlice<typeof onboardingSlice> {}
}

/** The slice injected into the root reducer when the lazy onboarding chunk loads. */
const injected = onboardingSlice.injectInto(rootReducer);

export const { selectDraft } = injected.selectors;
export const {
  householdSelected,
  weekdayMinutesSelected,
  exclusionsChanged,
  stepForward,
  stepBack,
  reset,
} = onboardingSlice.actions;
