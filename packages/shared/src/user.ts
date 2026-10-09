import { z } from 'zod/mini';

import { DISH_TAGS, HOUSEHOLDS, SUBSCRIPTION_PLANS, WEEKDAY_MINUTES } from './constants.ts';

/** The current user's profile and settings, as the client sees it (`users`). */
export const userProfileSchema = z.object({
  id: z.string().check(z.minLength(1)),
  tgId: z.int().check(z.positive()),
  firstName: z.string(),
  username: z.nullable(z.string()),
  photoUrl: z.nullable(z.string()),
  /** Onboarding answers; `null` until the onboarding is done. */
  household: z.nullable(z.enum(HOUSEHOLDS)),
  weekdayMinutes: z.nullable(z.literal(WEEKDAY_MINUTES)),
  exclusions: z.array(z.enum(DISH_TAGS)),
  /** IANA time zone, e.g. `Europe/Moscow`. */
  timezone: z.string().check(z.minLength(1)),
  reminderEnabled: z.boolean(),
  /** `HH:MM`, step 30 minutes. */
  reminderTime: z.string().check(z.regex(/^([01]\d|2[0-3]):(00|30)$/)),
  botCanWrite: z.boolean(),
  inviteCode: z.string().check(z.minLength(1)),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * Subscription status computed by the server. `active` — there is an `active` subscription with
 * `expiresAt` in the future; `plan` and `expiresAt` describe the latest paid period, if any.
 */
export const subscriptionStatusSchema = z.object({
  active: z.boolean(),
  plan: z.nullable(z.enum(SUBSCRIPTION_PLANS)),
  expiresAt: z.nullable(z.iso.datetime({ offset: true })),
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
