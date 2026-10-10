import {
  COOK_PHOTO_FIELD,
  createCookResponseSchema,
  uploadCookPhotoResponseSchema,
  type CreateCookRequest,
  type CreateCookResponse,
  type UploadCookPhotoResponse,
} from '@tma80/shared';

import { api } from './api.ts';

export const cooksApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `POST /uploads/cook-photo`: the compressed photo (multipart) → its private `photoPath`. */
    uploadCookPhoto: build.mutation<UploadCookPhotoResponse, Blob>({
      query: (photo) => {
        const body = new FormData();
        body.append(COOK_PHOTO_FIELD, photo, 'photo.jpg');
        return { url: '/uploads/cook-photo', method: 'POST', body };
      },
      responseSchema: uploadCookPhotoResponseSchema,
    }),
    /** `POST /cooks`: the dish is cooked — the stamp, counters and the overtaken friend. */
    createCook: build.mutation<CreateCookResponse, CreateCookRequest>({
      query: (body) => ({ url: '/cooks', method: 'POST', body }),
      responseSchema: createCookResponseSchema,
      // Suggestions, counters and dish labels change with every cook.
      invalidatesTags: ['Cooks'],
    }),
  }),
});

export const { useUploadCookPhotoMutation, useCreateCookMutation } = cooksApi;

/** HTTP status of a failed API call (`429` — the daily cook limit, `403` — paywall). */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}
