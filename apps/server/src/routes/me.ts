import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  applyProfilePatch,
  hasOnboardingAnswers,
  updateMeRequestSchema,
  type MeResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { users } from '../db/schema.ts';
import { toUserProfile } from '../db/users.ts';
import { ApiHttpError } from '../http/errors.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/**
 * `PATCH /me`: onboarding answers (with own exclusions), reminder settings and the time zone.
 * Exclusions are stored normalised; `onboarded_at` is set once who eats and the weekday time are
 * both known.
 */
export function meRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.patch('/api/me', async (request): Promise<MeResponse> => {
    const patch = parseOr400(updateMeRequestSchema, request.body, 'Invalid profile update');
    const { id } = requireUser(request);
    const updated = await deps.db.transaction(async (tx) => {
      const [current] = await tx.select().from(users).where(eq(users.id, id)).for('update');
      if (!current) throw new ApiHttpError(401, 'unauthorized', 'Unknown user');
      const profile = applyProfilePatch(toUserProfile(current), patch);
      const [row] = await tx
        .update(users)
        .set({
          household: profile.household,
          weekdayMinutes: profile.weekdayMinutes,
          exclusions: profile.exclusions,
          customExclusions: profile.customExclusions,
          timezone: profile.timezone,
          reminderEnabled: profile.reminderEnabled,
          reminderTime: profile.reminderTime,
          onboardedAt: current.onboardedAt ?? (hasOnboardingAnswers(profile) ? deps.now() : null),
        })
        .where(eq(users.id, id))
        .returning();
      return row ?? current;
    });
    return { user: toUserProfile(updated), needsOnboarding: updated.onboardedAt === null };
  });
}
