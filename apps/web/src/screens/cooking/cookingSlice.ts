import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { rootReducer } from '../../store/store.ts';
import { isOverdue, pauseTimer, startTimer, type StepTimer } from './timers.ts';

/** Cooking progress of one dish. */
export interface DishCooking {
  /** Index of the step on screen, from 0. */
  step: number;
  /** Timers by step number (`n`); a step without an entry has its timer not started. */
  timers: Record<string, StepTimer>;
}

export interface CookingState {
  /** By dish id. */
  dishes: Record<string, DishCooking>;
  /**
   * Dishes finished with «Готово!» whose cook is not recorded yet: only they open the photo and
   * stamp screen, so a reload or a link there cannot record a cook twice.
   */
  awaitingStamp: Record<string, true>;
}

const initialState: CookingState = { dishes: {}, awaitingStamp: {} };

type DishPayload<T = object> = PayloadAction<{ dishId: string } & T>;

const entry = (state: CookingState, dishId: string): DishCooking =>
  (state.dishes[dishId] ??= { step: 0, timers: {} });

/**
 * Client state of the cooking mode: the current step and the step timers of each dish. Kept while
 * the app is open (not persisted): leaving the mode and coming back continues from the same step,
 * with the timers still counting.
 */
export const cookingSlice = createSlice({
  name: 'cooking',
  initialState,
  reducers: {
    stepChanged(state, action: DishPayload<{ step: number }>) {
      entry(state, action.payload.dishId).step = Math.max(0, Math.trunc(action.payload.step));
    },
    timerStarted(state, action: DishPayload<{ n: number; durationMs: number; now: number }>) {
      const { dishId, n, durationMs, now } = action.payload;
      const timers = entry(state, dishId).timers;
      timers[n] = startTimer(timers[n], durationMs, now);
    },
    timerPaused(state, action: DishPayload<{ n: number; now: number }>) {
      const { dishId, n, now } = action.payload;
      const timer = state.dishes[dishId]?.timers[n];
      if (timer) entry(state, dishId).timers[n] = pauseTimer(timer, now);
    },
    timerReset(state, action: DishPayload<{ n: number }>) {
      const { dishId, n } = action.payload;
      const cooking = state.dishes[dishId];
      if (cooking) {
        cooking.timers = Object.fromEntries(
          Object.entries(cooking.timers).filter(([key]) => key !== String(n)),
        );
      }
    },
    /** Marks every running timer of the dish that has reached its end as done. */
    timersElapsed(state, action: DishPayload<{ now: number }>) {
      const { dishId, now } = action.payload;
      const timers = state.dishes[dishId]?.timers ?? {};
      for (const [n, timer] of Object.entries(timers)) {
        if (isOverdue(timer, now)) timers[n] = { status: 'done' };
      }
    },
    /**
     * «Готово!»: the dish is cooked — its step and timers are dropped, and the photo and stamp
     * screen may record the cook.
     */
    cookingFinished(state, action: DishPayload) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a record keyed by dish id
      delete state.dishes[action.payload.dishId];
      state.awaitingStamp[action.payload.dishId] = true;
    },
    /**
     * The photo and stamp screen is done with the dish — the cook is recorded or the user left
     * without a choice: the screen needs a new «Готово!» to open again.
     */
    stampScreenClosed(state, action: DishPayload) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a record keyed by dish id
      delete state.awaitingStamp[action.payload.dishId];
    },
  },
  selectors: {
    selectDishCooking: (state, dishId: string): DishCooking | undefined => state.dishes[dishId],
    selectAwaitingStamp: (state, dishId: string): boolean => state.awaitingStamp[dishId] === true,
  },
});

declare module '../../store/store.ts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy slice augmentation
  export interface LazyLoadedSlices extends WithSlice<typeof cookingSlice> {}
}

/** The slice with its state injected into the store (the cooking screen chunk loads it). */
export const injectedCookingSlice = cookingSlice.injectInto(rootReducer);

export const {
  stepChanged,
  timerStarted,
  timerPaused,
  timerReset,
  timersElapsed,
  cookingFinished,
  stampScreenClosed,
} = cookingSlice.actions;
export const { selectDishCooking, selectAwaitingStamp } = injectedCookingSlice.selectors;
