import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import {
  addShoppingResponseSchema,
  dishResponseSchema,
  paywallErrorSchema,
  type AddShoppingRequest,
  type AddShoppingResponse,
  type DishPreview,
  type DishResponse,
} from '@tma80/shared';

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
    }),
    /** `POST /shopping`: the dish's ingredients to buy (replaces its unchecked items). */
    addToShopping: build.mutation<AddShoppingResponse, AddShoppingRequest>({
      query: (body) => ({ url: '/shopping', method: 'POST', body }),
      responseSchema: addShoppingResponseSchema,
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
