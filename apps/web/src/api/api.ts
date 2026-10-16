import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { AUTH_SCHEME } from '@tma80/shared';

import { getRawInitData } from '../telegram/sdk.ts';
import { API_URL } from './config.ts';

/** RTK Query API slice; endpoints are injected per feature (`injectEndpoints`). */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders(headers) {
      const initData = getRawInitData();
      if (initData) headers.set('Authorization', `${AUTH_SCHEME} ${initData}`);
      return headers;
    },
  }),
  /**
   * `Cooks` — data that depends on the user's cooks (suggestions, counters, dish labels);
   * `Shopping` — the shopping list (`GET /shopping`), changed by the dish card's cart;
   * `Subscription` — data with locks of closed countries (suggestions, map, dish access), changed
   * by a payment on the paywall; `Preferences` — data that depends on the onboarding answers
   * (suggestions, the default servings of a dish), changed in the profile (`PATCH /me`).
   */
  tagTypes: ['Cooks', 'Shopping', 'Subscription', 'Preferences'],
  endpoints: () => ({}),
});
