import { z } from 'zod/mini';

import { DISH_TAGS, HOUSEHOLDS, WEEKDAY_MINUTES } from './constants.ts';
import { reminderTimeSchema, timezoneSchema, userProfileSchema } from './user.ts';

/**
 * Request of `PATCH /api/me`: onboarding answers, reminder settings and the time zone. Every field
 * is optional, but at least one must be present; unknown fields are rejected. The server stores
 * `exclusions` normalised (`normalizeExclusions`) and sets `onboarded_at` once `household` and
 * `weekdayMinutes` are both known.
 */
export const updateMeRequestSchema = z
  .strictObject({
    household: z.optional(z.enum(HOUSEHOLDS)),
    weekdayMinutes: z.optional(z.literal(WEEKDAY_MINUTES)),
    exclusions: z.optional(
      z
        .array(z.enum(DISH_TAGS))
        .check(z.refine((tags) => new Set(tags).size === tags.length, 'Duplicate exclusions')),
    ),
    timezone: z.optional(timezoneSchema),
    reminderEnabled: z.optional(z.boolean()),
    reminderTime: z.optional(reminderTimeSchema),
  })
  .check(
    z.refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      'Nothing to update',
    ),
  );
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

/** Response of `PATCH /api/me`: the updated profile and the onboarding flag (as in `POST /auth`). */
export const meResponseSchema = z.object({
  user: userProfileSchema,
  needsOnboarding: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
