import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  buildLeaderboard,
  latestFriendStamps,
  leaderboardQuerySchema,
  type FeedResponse,
  type LeaderboardResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { cooksOf, friendsOf } from '../db/cooks.ts';
import { countries, dishes } from '../db/schema.ts';
import { signCookPhotoUrl } from '../media/signedLink.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/** `GET /friends/leaderboard` and `GET /friends/feed` with the shared ranking and feed rules. */
export function friendsRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/friends/leaderboard', async (request): Promise<LeaderboardResponse> => {
    const query = parseOr400(leaderboardQuerySchema, request.query, 'Invalid leaderboard period');
    const user = requireUser(request);
    const friends = await friendsOf(deps.db, user.id);
    const allCooks = await cooksOf(deps.db, [user.id, ...friends.map((friend) => friend.id)]);
    const cooksBy = (userId: string) => allCooks.filter((cook) => cook.userId === userId);
    return buildLeaderboard({
      me: {
        userId: user.id,
        firstName: user.firstName,
        photoUrl: user.photoUrl,
        cooks: cooksBy(user.id),
      },
      friends: friends.map((friend) => ({
        userId: friend.id,
        firstName: friend.firstName,
        photoUrl: friend.photoUrl,
        cooks: cooksBy(friend.id),
      })),
      period: query.period,
      now: deps.now(),
      timezone: user.timezone,
    });
  });

  app.get('/api/friends/feed', async (request): Promise<FeedResponse> => {
    const user = requireUser(request);
    const friends = await friendsOf(deps.db, user.id);
    const friendCooks = await cooksOf(
      deps.db,
      friends.map((friend) => friend.id),
    );
    const stamps = latestFriendStamps(
      friends.map((friend) =>
        friendCooks
          .filter((cook) => cook.userId === friend.id)
          .map((cook) => ({ ...cook, firstName: friend.firstName })),
      ),
    );
    if (stamps.length === 0) return { items: [] };
    const now = deps.now();
    // Titles and names of the stamps, unpublished content included: a stamp stays a stamp.
    const [dishRows, countryRows] = await Promise.all([
      deps.db
        .select({ id: dishes.id, title: dishes.title })
        .from(dishes)
        .where(
          inArray(
            dishes.id,
            stamps.map((stamp) => stamp.dishId),
          ),
        ),
      deps.db
        .select({ id: countries.id, nameRu: countries.nameRu })
        .from(countries)
        .where(
          inArray(
            countries.id,
            stamps.map((stamp) => stamp.countryId),
          ),
        ),
    ]);
    const titles = new Map(dishRows.map((row) => [row.id, row.title]));
    const names = new Map(countryRows.map((row) => [row.id, row.nameRu]));
    return {
      items: stamps.flatMap((stamp) => {
        const dishTitle = titles.get(stamp.dishId);
        const countryName = names.get(stamp.countryId);
        if (dishTitle === undefined || countryName === undefined) return [];
        return [
          {
            cookId: stamp.id,
            userId: stamp.userId,
            firstName: stamp.firstName,
            countryId: stamp.countryId,
            countryName,
            dishId: stamp.dishId,
            dishTitle,
            // Only friends' cooks get here: a link to a stranger's photo is never signed.
            photoUrl:
              stamp.photoPath === null
                ? null
                : signCookPhotoUrl(deps.mediaUrl, stamp.photoPath, deps.mediaSigningKey, now),
            createdAt: stamp.createdAt,
          },
        ];
      }),
    };
  });
}
