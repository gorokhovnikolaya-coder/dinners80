import {
  SHARE_CARD_FIELD,
  shareStampResponseSchema,
  uploadShareCardResponseSchema,
  type ShareStampResponse,
  type UploadShareCardResponse,
} from '@tma80/shared';

import { api } from './api.ts';

export const shareApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * `POST /uploads/share-card?cookId=`: the card of the cook (JPEG, multipart) → its public URL;
     * the server keeps one card per cook and answers the same URL again.
     */
    uploadShareCard: build.mutation<UploadShareCardResponse, { cookId: string; card: Blob }>({
      query: ({ cookId, card }) => {
        const body = new FormData();
        body.append(SHARE_CARD_FIELD, card, 'card.jpg');
        return {
          url: `/uploads/share-card?${new URLSearchParams({ cookId }).toString()}`,
          method: 'POST',
          body,
        };
      },
      responseSchema: uploadShareCardResponseSchema,
    }),
    /** `POST /share/stamp/:cookId`: the prepared inline message with the card for `shareMessage`. */
    prepareShareStamp: build.mutation<ShareStampResponse, string>({
      query: (cookId) => ({ url: `/share/stamp/${encodeURIComponent(cookId)}`, method: 'POST' }),
      responseSchema: shareStampResponseSchema,
    }),
  }),
});

export const { useUploadShareCardMutation, usePrepareShareStampMutation } = shareApi;
