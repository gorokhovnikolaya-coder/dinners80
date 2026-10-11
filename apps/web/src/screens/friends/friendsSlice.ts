import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import type { LeaderboardPeriod } from '@tma80/shared';

import { rootReducer } from '../../store/store.ts';

export interface FriendsState {
  /** Period of the ranking; «Эта неделя» on the first open, then the user's choice. */
  period: LeaderboardPeriod;
}

const initialState: FriendsState = { period: 'week' };

/** Client state of the friends screen, kept while the app is open (not persisted). */
export const friendsSlice = createSlice({
  name: 'friends',
  initialState,
  reducers: {
    periodChosen(state, action: PayloadAction<LeaderboardPeriod>) {
      state.period = action.payload;
    },
  },
  selectors: {
    selectPeriod: (state) => state.period,
  },
});

declare module '../../store/store.ts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy slice augmentation
  export interface LazyLoadedSlices extends WithSlice<typeof friendsSlice> {}
}

/** The slice with its state injected into the store (the friends screen chunk loads it). */
export const injectedFriendsSlice = friendsSlice.injectInto(rootReducer);

export const { periodChosen } = friendsSlice.actions;
export const { selectPeriod } = injectedFriendsSlice.selectors;
