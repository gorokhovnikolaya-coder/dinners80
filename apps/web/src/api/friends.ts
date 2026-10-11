import {
  feedResponseSchema,
  leaderboardResponseSchema,
  type FeedResponse,
  type LeaderboardPeriod,
  type LeaderboardResponse,
} from '@tma80/shared';

import { api } from './api.ts';

export const friendsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /friends/leaderboard`: the user and the friends ranked for the period. */
    friendsLeaderboard: build.query<LeaderboardResponse, LeaderboardPeriod>({
      query: (period) => ({ url: '/friends/leaderboard', params: { period } }),
      responseSchema: leaderboardResponseSchema,
      // A new cook changes the user's counters in the ranking.
      providesTags: ['Cooks'],
    }),
    /** `GET /friends/feed`: the latest stamps of friends. */
    friendsFeed: build.query<FeedResponse, undefined>({
      query: () => '/friends/feed',
      responseSchema: feedResponseSchema,
    }),
  }),
});

export const { useFriendsLeaderboardQuery, useFriendsFeedQuery } = friendsApi;
