import { combineSlices, configureStore } from '@reduxjs/toolkit';

import { api } from '../api/api.ts';
import { homeSlice } from '../screens/home/homeSlice.ts';

/**
 * Slices of lazily loaded screens. A screen adds its slice by module augmentation
 * (`interface LazyLoadedSlices extends WithSlice<typeof slice> {}`) and `slice.injectInto(rootReducer)`
 * in its own chunk, so the slice code stays out of the initial bundle.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extended by lazy screens (RTK `combineSlices` pattern)
export interface LazyLoadedSlices {}

export const rootReducer = combineSlices(api, homeSlice).withLazyLoadedSlices<LazyLoadedSlices>();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
