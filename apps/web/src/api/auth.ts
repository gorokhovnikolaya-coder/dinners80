import { authResponseSchema, type AuthResponse } from '@tma80/shared';

import { api } from './api.ts';

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `POST /auth`: the server checks initData and returns the profile. A query (not a mutation)
     * so the result is cached and shared by all screens.
     */
    auth: build.query<AuthResponse, undefined>({
      query: () => ({ url: '/auth', method: 'POST' }),
      responseSchema: authResponseSchema,
    }),
  }),
});

export const { useAuthQuery } = authApi;
