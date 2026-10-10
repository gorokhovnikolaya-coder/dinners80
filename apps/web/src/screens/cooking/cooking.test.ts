import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { rootReducer } from '../../store/store.ts';
import {
  cookingFinished,
  cookRecorded,
  selectAwaitingStamp,
  selectDishCooking,
  stepChanged,
  timerPaused,
  timerReset,
  timersElapsed,
  timerStarted,
} from './cookingSlice.ts';
import { formatTimer, isOverdue, pauseTimer, remainingMs, startTimer } from './timers.ts';

const MIN = 60_000;

describe('timers', () => {
  it('counts down from the end moment, so time passes in the background too', () => {
    const timer = startTimer(undefined, 3 * MIN, 1_000);
    expect(timer).toEqual({ status: 'running', endsAt: 1_000 + 3 * MIN });
    expect(remainingMs(timer, 3 * MIN, 1_000 + MIN)).toBe(2 * MIN);
    expect(remainingMs(timer, 3 * MIN, 1_000 + 10 * MIN)).toBe(0);
    expect(isOverdue(timer, 1_000 + 3 * MIN - 1)).toBe(false);
    expect(isOverdue(timer, 1_000 + 3 * MIN)).toBe(true);
  });

  it('pauses with the time left and resumes from it', () => {
    const paused = pauseTimer(startTimer(undefined, 3 * MIN, 0), MIN);
    expect(paused).toEqual({ status: 'paused', remainingMs: 2 * MIN });
    expect(remainingMs(paused, 3 * MIN, 50 * MIN)).toBe(2 * MIN);
    expect(isOverdue(paused, 50 * MIN)).toBe(false);
    expect(startTimer(paused, 3 * MIN, 10 * MIN)).toEqual({
      status: 'running',
      endsAt: 12 * MIN,
    });
  });

  it('starts a finished timer over and shows the full time when not started', () => {
    expect(startTimer({ status: 'done' }, 3 * MIN, 0)).toEqual({
      status: 'running',
      endsAt: 3 * MIN,
    });
    expect(remainingMs(undefined, 3 * MIN, 0)).toBe(3 * MIN);
    expect(remainingMs({ status: 'done' }, 3 * MIN, 0)).toBe(0);
    expect(pauseTimer({ status: 'done' }, 0)).toEqual({ status: 'done' });
  });

  it('formats minutes and hours, rounding seconds up', () => {
    expect(formatTimer(3 * MIN)).toBe('3:00');
    expect(formatTimer(3 * MIN - 1)).toBe('3:00');
    expect(formatTimer(65_000)).toBe('1:05');
    expect(formatTimer(1)).toBe('0:01');
    expect(formatTimer(0)).toBe('0:00');
    expect(formatTimer(-5)).toBe('0:00');
    expect(formatTimer(150 * MIN)).toBe('2:30:00');
  });
});

describe('cooking slice', () => {
  const setup = () => configureStore({ reducer: rootReducer });
  const cooking = (store: ReturnType<typeof setup>, dishId = 'it-lasagna') =>
    selectDishCooking(store.getState(), dishId);

  it('keeps the step and the timers per dish', () => {
    const store = setup();
    expect(cooking(store)).toBeUndefined();
    store.dispatch(stepChanged({ dishId: 'it-lasagna', step: 2 }));
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 2, durationMs: 40 * MIN, now: 0 }));
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 4, durationMs: 40 * MIN, now: MIN }));
    store.dispatch(stepChanged({ dishId: 'fr-omelette', step: 1 }));
    expect(cooking(store)).toEqual({
      step: 2,
      timers: {
        2: { status: 'running', endsAt: 40 * MIN },
        4: { status: 'running', endsAt: 41 * MIN },
      },
    });
    expect(cooking(store, 'fr-omelette')).toEqual({ step: 1, timers: {} });
  });

  it('pauses, resets and marks elapsed timers as done', () => {
    const store = setup();
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 1, durationMs: 10 * MIN, now: 0 }));
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 2, durationMs: 40 * MIN, now: 0 }));
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 4, durationMs: 40 * MIN, now: 0 }));
    store.dispatch(timerPaused({ dishId: 'it-lasagna', n: 2, now: 5 * MIN }));
    store.dispatch(timerReset({ dishId: 'it-lasagna', n: 4 }));
    store.dispatch(timersElapsed({ dishId: 'it-lasagna', now: 60 * MIN }));
    expect(cooking(store)?.timers).toEqual({
      1: { status: 'done' },
      2: { status: 'paused', remainingMs: 35 * MIN },
    });
    // Pausing a timer that was never started changes nothing.
    store.dispatch(timerPaused({ dishId: 'it-lasagna', n: 3, now: 0 }));
    expect(cooking(store)?.timers[3]).toBeUndefined();
  });

  it('drops the step and the timers when the dish is cooked', () => {
    const store = setup();
    store.dispatch(stepChanged({ dishId: 'it-lasagna', step: 3 }));
    store.dispatch(timerStarted({ dishId: 'it-lasagna', n: 4, durationMs: 40 * MIN, now: 0 }));
    store.dispatch(cookingFinished({ dishId: 'it-lasagna' }));
    expect(cooking(store)).toBeUndefined();
  });

  it('lets the stamp screen record a cook once per «Готово!»', () => {
    const store = setup();
    expect(selectAwaitingStamp(store.getState(), 'it-lasagna')).toBe(false);
    store.dispatch(cookingFinished({ dishId: 'it-lasagna' }));
    expect(selectAwaitingStamp(store.getState(), 'it-lasagna')).toBe(true);
    expect(selectAwaitingStamp(store.getState(), 'fr-omelette')).toBe(false);
    store.dispatch(cookRecorded({ dishId: 'it-lasagna' }));
    expect(selectAwaitingStamp(store.getState(), 'it-lasagna')).toBe(false);
  });

  it('never stores a negative step', () => {
    const store = setup();
    store.dispatch(stepChanged({ dishId: 'it-lasagna', step: -1 }));
    expect(cooking(store)?.step).toBe(0);
  });
});
