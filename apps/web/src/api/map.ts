import { mapResponseSchema, type MapResponse } from '@tma80/shared';

import { api } from './api.ts';

export const mapApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /map`: the passport — counters and the countries by continent with their dishes. */
    map: build.query<MapResponse, undefined>({
      query: () => '/map',
      responseSchema: mapResponseSchema,
      providesTags: ['Cooks'],
    }),
  }),
});

export const { useMapQuery } = mapApi;
