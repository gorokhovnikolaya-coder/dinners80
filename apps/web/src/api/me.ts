import {
  changesPreferences,
  meResponseSchema,
  type MeResponse,
  type UpdateMeRequest,
} from '@tma80/shared';

import { api } from './api.ts';
import { authApi } from './auth.ts';

export const meApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `PATCH /me`: onboarding answers, reminders, time zone. On success the cached `POST /auth`
     * result gets the new profile and `needsOnboarding`, so screens update without a refetch;
     * a changed answer also refetches the suggestions and dish defaults (`Preferences`).
     */
    updateMe: build.mutation<MeResponse, UpdateMeRequest>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      responseSchema: meResponseSchema,
      invalidatesTags: (_result, error, body) =>
        error === undefined && changesPreferences(body) ? ['Preferences'] : [],
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            authApi.util.updateQueryData('auth', undefined, (draft) => {
              draft.user = data.user;
              draft.needsOnboarding = data.needsOnboarding;
            }),
          );
        } catch {
          // The error is shown by the caller through the mutation state.
        }
      },
    }),
  }),
});

export const { useUpdateMeMutation } = meApi;
