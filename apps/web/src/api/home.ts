import { homeResponseSchema, type HomeQuery, type HomeResponse } from '@tma80/shared';

import { api } from './api.ts';

export const homeApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /home?mode=&page=`: a page of suggestions and the counters of the main screen. */
    home: build.query<HomeResponse, HomeQuery>({
      query: ({ mode, page }) => ({ url: '/home', params: { mode, page } }),
      responseSchema: homeResponseSchema,
    }),
  }),
});

export const { useHomeQuery } = homeApi;
