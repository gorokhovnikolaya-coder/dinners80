import { createSlice, type WithSlice } from '@reduxjs/toolkit';

import { rootReducer } from '../../store/store.ts';

export interface ProfileState {
  /**
   * The user let the bot write in this session (`requestWriteAccess` → «allowed»). The server
   * learns it from the bot webhook (`write_access_allowed`), which may come after `PATCH /me`
   * answers, so until then the profile's `botCanWrite` can still say `false`.
   */
  writeAccessAllowed: boolean;
}

const initialState: ProfileState = { writeAccessAllowed: false };

/** Client state of the profile, kept while the app is open (not persisted). */
export const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    writeAccessAllowed(state) {
      state.writeAccessAllowed = true;
    },
  },
  selectors: {
    selectWriteAccessAllowed: (state) => state.writeAccessAllowed,
  },
});

declare module '../../store/store.ts' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy slice augmentation
  export interface LazyLoadedSlices extends WithSlice<typeof profileSlice> {}
}

/** The slice with its state injected into the store (the profile chunk loads it). */
export const injectedProfileSlice = profileSlice.injectInto(rootReducer);

export const { writeAccessAllowed } = profileSlice.actions;
export const { selectWriteAccessAllowed } = injectedProfileSlice.selectors;
