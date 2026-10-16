import {
  createInvoiceResponseSchema,
  type CreateInvoiceRequest,
  type CreateInvoiceResponse,
} from '@tma80/shared';

import { api } from './api.ts';

export const paymentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `POST /payments/invoice`: the Telegram Stars invoice link for the plan. */
    createInvoice: build.mutation<CreateInvoiceResponse, CreateInvoiceRequest>({
      query: (body) => ({ url: '/payments/invoice', method: 'POST', body }),
      responseSchema: createInvoiceResponseSchema,
    }),
  }),
});

export const { useCreateInvoiceMutation } = paymentsApi;
