import { z } from 'zod/mini';

import { HOUSEHOLDS, WEEKDAY_MINUTES } from './constants.ts';
import { normalizeCustomExclusions, normalizeExclusions } from './preferences.ts';
import {
  customExclusionsSchema,
  exclusionsSchema,
  reminderTimeSchema,
  timezoneSchema,
  userProfileSchema,
  type UserProfile,
} from './user.ts';

/**
 * Request of `PATCH /api/me`: onboarding answers, reminder settings and the time zone. Every field
 * is optional, but at least one must be present; unknown fields are rejected. The server stores
 * `exclusions` and `customExclusions` normalised (`normalizeExclusions`,
 * `normalizeCustomExclusions`) and sets `onboarded_at` once `household` and
 * `weekdayMinutes` are both known.
 */
export const updateMeRequestSchema = z
  .strictObject({
    household: z.optional(z.enum(HOUSEHOLDS)),
    weekdayMinutes: z.optional(z.literal(WEEKDAY_MINUTES)),
    exclusions: z.optional(exclusionsSchema),
    customExclusions: z.optional(customExclusionsSchema),
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

/**
 * The profile after `PATCH /me` as the server applies it: sent fields replace the stored ones,
 * missing fields stay; both kinds of exclusions are stored normalised. The client uses it to show
 * changes that are still being saved (the profile autosaves).
 */
export function applyProfilePatch(profile: UserProfile, patch: UpdateMeRequest): UserProfile {
  return {
    ...profile,
    household: patch.household ?? profile.household,
    weekdayMinutes: patch.weekdayMinutes ?? profile.weekdayMinutes,
    exclusions: patch.exclusions ? normalizeExclusions(patch.exclusions) : profile.exclusions,
    customExclusions: patch.customExclusions
      ? normalizeCustomExclusions(patch.customExclusions)
      : profile.customExclusions,
    timezone: patch.timezone ?? profile.timezone,
    reminderEnabled: patch.reminderEnabled ?? profile.reminderEnabled,
    reminderTime: patch.reminderTime ?? profile.reminderTime,
  };
}

/**
 * Onboarding answers among the `PATCH /me` fields: they change what the server sends back for
 * suggestions (`GET /home`: time on weekdays, exclusions) and dish cards (`GET /dishes/:id`
 * without `servings`: the default servings by «who eats»).
 */
const PREFERENCE_FIELDS = ['household', 'weekdayMinutes', 'exclusions', 'customExclusions'] as const;

/** True if the update changes an onboarding answer (see `PREFERENCE_FIELDS`). */
export function changesPreferences(patch: UpdateMeRequest): boolean {
  return PREFERENCE_FIELDS.some((field) => patch[field] !== undefined);
}
