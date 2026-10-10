import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SuggestionMode } from '@tma80/shared';

export interface HomeState {
  /** Mode chosen with the switch; `null` — not chosen yet, the day of the week decides. */
  mode: SuggestionMode | null;
  /** Current page of each mode («Показать другие»), kept while the app is open. */
  page: Record<SuggestionMode, number>;
}

const initialState: HomeState = { mode: null, page: { weekday: 0, weekend: 0 } };

/** Client state of the main screen: the chosen mode and pages (not persisted between launches). */
export const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    modeChosen(state, action: PayloadAction<SuggestionMode>) {
      state.mode = action.payload;
    },
    pageShown(state, action: PayloadAction<{ mode: SuggestionMode; page: number }>) {
      state.page[action.payload.mode] = action.payload.page;
    },
  },
  selectors: {
    selectChosenMode: (state) => state.mode,
    selectPages: (state) => state.page,
  },
});

export const { modeChosen, pageShown } = homeSlice.actions;
export const { selectChosenMode, selectPages } = homeSlice.selectors;
