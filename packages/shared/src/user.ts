import { z } from 'zod/mini';

import { DISH_TAGS, HOUSEHOLDS, SUBSCRIPTION_PLANS, WEEKDAY_MINUTES } from './constants.ts';

/**
 * Shape of an IANA time zone name (`Europe/Moscow`, `America/Argentina/Buenos_Aires`, `UTC`):
 * segments of letters, digits, `_`, `+`, `-` separated by `/`. Offsets such as `+03:00` do not match.
 */
const TIME_ZONE_NAME_RE = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

/**
 * True for an IANA time zone name the runtime knows (`Europe/Moscow`, `UTC`). Offsets such as
 * `+03:00`, which newer `Intl` versions also accept, are rejected: the server needs a named zone.
 * The answer depends on the runtime's ICU data, so use it only where the runtime is ours (the
 * server, or the client checking its own `Intl` value before sending it).
 */
export function isIanaTimeZone(value: string): boolean {
  if (!TIME_ZONE_NAME_RE.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Time zone name as stored in `users.timezone` and returned by the server: 1–64 characters in the
 * IANA name format. Deliberately no `Intl` check: the client parses server responses with this
 * schema, and an old WebView whose ICU lacks a newer zone (e.g. `Europe/Kyiv`) must still open the app.
 */
export const timezoneNameSchema = z
  .string()
  .check(z.minLength(1), z.maxLength(64), z.regex(TIME_ZONE_NAME_RE));

/**
 * Time zone accepted from the client (`PATCH /me`): a name the server's `Intl` knows. Only the
 * server parses requests with this schema.
 */
export const timezoneSchema = timezoneNameSchema.check(
  z.refine(isIanaTimeZone, 'Unknown time zone'),
);

/** Dinner reminder time `HH:MM`, step 30 minutes (`users.reminder_time`). */
export const reminderTimeSchema = z.string().check(z.regex(/^([01]\d|2[0-3]):(00|30)$/));

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
  /** IANA time zone, e.g. `Europe/Moscow` (format only, see `timezoneNameSchema`). */
  timezone: timezoneNameSchema,
  reminderEnabled: z.boolean(),
  /** `HH:MM`, step 30 minutes. */
  reminderTime: reminderTimeSchema,
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
