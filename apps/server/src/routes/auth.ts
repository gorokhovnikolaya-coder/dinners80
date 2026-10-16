import type { FastifyInstance } from 'fastify';

import type { AuthResponse } from '@tma80/shared';

import { requireInitData } from '../auth/plugin.ts';
import type { Db } from '../db/client.ts';
import { signIn, subscriptionStatus, toUserProfile } from '../db/users.ts';

/**
 * `POST /auth`: checks initData (the auth hook), creates or refreshes the user, handles the
 * invitation in `start_param` and returns the profile, the subscription and the onboarding flag.
 */
export function authRoutes(app: FastifyInstance, deps: { db: Db; now: () => Date }): void {
  app.post(
    '/api/auth',
    { config: { auth: 'initData' } },
    async (request): Promise<AuthResponse> => {
      const now = deps.now();
      const { user } = await signIn(deps.db, requireInitData(request), now);
      return {
        user: toUserProfile(user),
        subscription: await subscriptionStatus(deps.db, user.id, now),
        needsOnboarding: user.onboardedAt === null,
      };
    },
  );
}
