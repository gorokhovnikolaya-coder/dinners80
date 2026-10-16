import { QueryStatus, type FetchBaseQueryError } from '@reduxjs/toolkit/query';
import {
  addShoppingResponseSchema,
  dishResponseSchema,
  paywallErrorSchema,
  type AddShoppingRequest,
  type AddShoppingResponse,
  type DishPreview,
  type DishResponse,
} from '@tma80/shared';

import type { RootState } from '../store/store.ts';
import { api } from './api.ts';

export interface DishArgs {
  id: string;
  /** Servings of the recalculated amounts; omitted — the server's default by «who eats». */
  servings?: number;
}

export const dishesApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /dishes/:id?servings=`: the dish card; `403 paywall` for a closed country. */
    dish: build.query<DishResponse, DishArgs>({
      query: ({ id, servings }) => ({
        url: `/dishes/${encodeURIComponent(id)}`,
        params: servings === undefined ? {} : { servings },
      }),
      responseSchema: dishResponseSchema,
      // Locks and access change with a subscription (the paywall invalidates `Subscription`);
      // without `servings` the server picks them by «who eats», which the profile can change.
      providesTags: (_result, _error, { servings }) =>
        servings === undefined
          ? ['Cooks', 'Subscription', 'Preferences']
          : ['Cooks', 'Subscription'],
    }),
    /** `POST /shopping`: the dish's ingredients to buy (replaces its unchecked items). */
    addToShopping: build.mutation<AddShoppingResponse, AddShoppingRequest>({
      query: (body) => ({ url: '/shopping', method: 'POST', body }),
      responseSchema: addShoppingResponseSchema,
      invalidatesTags: ['Shopping'],
    }),
  }),
});

export const { useDishQuery, useAddToShoppingMutation } = dishesApi;

/** The preview of a closed dish if the error is the `403 paywall` of `GET /dishes/:id`. */
export function paywallPreview(error: unknown): DishPreview | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const { status, data } = error as FetchBaseQueryError;
  if (status !== 403) return undefined;
  const parsed = paywallErrorSchema.safeParse(data);
  return parsed.success ? parsed.data.error.preview : undefined;
}

/** True if the error is a `404` of the API. */
export function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/**
 * Arguments of a loaded `GET /dishes/:id` of this dish in the cache (e.g. the card just opened),
 * so the cooking mode subscribes to the same entry: no new request, and the steps stay on screen
 * if the connection drops.
 */
export function selectLoadedDishArgs(state: RootState, id: string): DishArgs | undefined {
  for (const query of Object.values(state.api.queries)) {
    if (query?.endpointName !== 'dish' || query.status !== QueryStatus.fulfilled) continue;
    // The cache types `originalArgs` as `unknown` for every endpoint; entries of `dish` were
    // created by `useDishQuery`, so their arguments are `DishArgs`.
    const args = query.originalArgs as DishArgs;
    if (args.id === id) return args;
  }
  return undefined;
}
