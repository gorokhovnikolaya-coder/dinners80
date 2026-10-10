import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { clampServings } from '@tma80/shared';

import { rootReducer } from '../../store/store.ts';

export interface DishState {
  /** Servings chosen on a dish card, by dish id; the cooking mode uses the same value. */
  servings: Record<string, number>;
  /** Ingredient keys marked «есть дома», by dish id. */
  atHome: Record<string, string[]>;
}

const initialState: DishState = { servings: {}, atHome: {} };

/**
 * Client state of dish cards: servings and «есть дома» marks per dish. Kept while the app is
 * open (not persisted): returning to a dish shows the same servings and marks.
 */
export const dishSlice = createSlice({
  name: 'dish',
  initialState,
  reducers: {
    servingsChosen(state, action: PayloadAction<{ dishId: string; servings: number }>) {
      state.servings[action.payload.dishId] = clampServings(action.payload.servings);
    },
    atHomeToggled(state, action: PayloadAction<{ dishId: string; key: string; atHome: boolean }>) {
      const { dishId, key, atHome } = action.payload;
      const keys = (state.atHome[dishId] ?? []).filter((item) => item !== key);
      if (atHome) keys.push(key);
      state.atHome[dishId] = keys;
    },
  },
  selectors: {
    selectServings: (state, dishId: string): number | undefined => state.servings[dishId],
    selectAtHome: (state, dishId: string): readonly string[] | undefined => state.atHome[dishId],
  },
});

declare module '../../store/store.ts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy slice augmentation
  export interface LazyLoadedSlices extends WithSlice<typeof dishSlice> {}
}

/** The slice with its state injected into the store (the dish screen chunk loads it). */
export const injectedDishSlice = dishSlice.injectInto(rootReducer);

export const { servingsChosen, atHomeToggled } = dishSlice.actions;
export const { selectServings, selectAtHome } = injectedDishSlice.selectors;
