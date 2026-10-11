import {
  clearShoppingResponseSchema,
  shoppingResponseSchema,
  updateShoppingItemResponseSchema,
  type ClearShoppingResponse,
  type ShoppingResponse,
} from '@tma80/shared';

import { api } from './api.ts';

export interface CheckShoppingArgs {
  /** Items of a row of the list: all of them are marked. */
  ids: readonly string[];
  checked: boolean;
}

export const shoppingApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /shopping`: the user's shopping items. */
    shopping: build.query<ShoppingResponse, undefined>({
      query: () => '/shopping',
      responseSchema: shoppingResponseSchema,
      providesTags: ['Shopping'],
    }),
    /**
     * `PATCH /shopping/:id` for every item of a row. The list is updated at once (optimistic) and
     * rolled back if any request fails, then
     * refetched: the other items of the row may be marked on the server already.
     */
    checkShopping: build.mutation<null, CheckShoppingArgs>({
      async queryFn({ ids, checked }, _api, _extra, baseQuery) {
        const results = await Promise.all(
          ids.map((id) =>
            Promise.resolve(
              baseQuery({
                url: `/shopping/${encodeURIComponent(id)}`,
                method: 'PATCH',
                body: { checked },
              }),
            ),
          ),
        );
        for (const result of results) {
          if (result.error) return { error: result.error };
          if (!updateShoppingItemResponseSchema.safeParse(result.data).success)
            return {
              error: {
                status: 'PARSING_ERROR',
                originalStatus: 200,
                data: '',
                error: 'Invalid shopping item',
              },
            };
        }
        return { data: null };
      },
      async onQueryStarted({ ids, checked }, { dispatch, queryFulfilled }) {
        const marked = new Set(ids);
        const patch = dispatch(
          shoppingApi.util.updateQueryData('shopping', undefined, (draft) => {
            for (const item of draft.items) if (marked.has(item.id)) item.checked = checked;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
          // Some items of the row may be marked on the server already: reload the list.
          dispatch(api.util.invalidateTags(['Shopping']));
        }
      },
    }),
    /** `DELETE /shopping/checked`: removes the bought items; the list drops them on success. */
    clearCheckedShopping: build.mutation<ClearShoppingResponse, undefined>({
      query: () => ({ url: '/shopping/checked', method: 'DELETE' }),
      responseSchema: clearShoppingResponseSchema,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          return;
        }
        dispatch(
          shoppingApi.util.updateQueryData('shopping', undefined, (draft) => {
            draft.items = draft.items.filter((item) => !item.checked);
          }),
        );
      },
    }),
  }),
});

export const { useShoppingQuery, useCheckShoppingMutation, useClearCheckedShoppingMutation } =
  shoppingApi;
