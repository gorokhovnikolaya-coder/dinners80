import { z } from 'zod/mini';

import { subscriptionStatusSchema, userProfileSchema } from './user.ts';

/** Response of `POST /api/auth`: profile, subscription status and the onboarding flag. */
export const authResponseSchema = z.object({
  user: userProfileSchema,
  subscription: subscriptionStatusSchema,
  needsOnboarding: z.boolean(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Scheme of the `Authorization` header: `Authorization: tma <raw initData>`. */
export const AUTH_SCHEME = 'tma';
