import { z } from 'zod/mini';

/** Most stamps `GET /friends/feed` returns (ТЗ: «до 20 записей»). */
export const FRIENDS_FEED_LIMIT = 20;

/** Periods of the friends ranking: «Эта неделя» and «Всё время». */
export const LEADERBOARD_PERIODS = ['week', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

/** Query of `GET /api/friends/leaderboard?period=week|all`. */
export const leaderboardQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/** A row of the ranking: the user or a friend with the counters of the period. */
export const leaderboardEntrySchema = z.object({
  userId: z.string().check(z.minLength(1)),
  firstName: z.string(),
  /** Telegram profile photo, if any. */
  photoUrl: z.nullable(z.string()),
  /** The row of the user who asked for the ranking («Вы»). */
  isMe: z.boolean(),
  /** 1-based; equal countries and dishes share a place (1, 2, 2, 4). */
  place: z.int().check(z.positive()),
  /** Countries of the period: «Всё время» — passed countries, «Эта неделя» — first stamps this week. */
  countries: z.int().check(z.nonnegative()),
  /** Cooks of the period, repeats included. */
  dishes: z.int().check(z.nonnegative()),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** Response of `GET /api/friends/leaderboard`: the user and the friends, best first. */
export const leaderboardResponseSchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS),
  entries: z.array(leaderboardEntrySchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

/** A stamp of a friend in the feed: the first cook of a country. */
export const feedItemSchema = z.object({
  cookId: z.string().check(z.minLength(1)),
  userId: z.string().check(z.minLength(1)),
  firstName: z.string(),
  countryId: z.string().check(z.minLength(1)),
  countryName: z.string().check(z.minLength(1)),
  dishId: z.string().check(z.minLength(1)),
  dishTitle: z.string().check(z.minLength(1)),
  /** Signed link to the friend's photo (1 hour); `null` — cooked without a photo. */
  photoUrl: z.nullable(z.string()),
  createdAt: z.iso.datetime({ offset: true }),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

/** Response of `GET /api/friends/feed`: the latest stamps of friends, newest first. */
export const feedResponseSchema = z.object({
  items: z.array(feedItemSchema).check(z.maxLength(FRIENDS_FEED_LIMIT)),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

/** Offset of `timezone` from UTC at the instant `at`, in ms (local wall time − UTC). */
function zoneOffsetMs(at: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wall - Math.floor(at / 1000) * 1000;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Start of the current week: Monday 00:00 in `timezone` (ТЗ: the week of the ranking is counted in
 * the time zone of the user who asks for it, the same for all participants).
 */
export function weekStart(now: Date, timezone: string): Date {
  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    local.find((item) => item.type === type)?.value ?? '';
  const daysSinceMonday = Math.max(0, WEEKDAYS.indexOf(part('weekday')));
  // Midnight of Monday as if the zone were UTC, then shifted by the zone offset at that moment;
  // the second pass settles a DST change between the guess and the real instant.
  const wallMidnight = Date.UTC(
    Number(part('year')),
    Number(part('month')) - 1,
    Number(part('day')) - daysSinceMonday,
  );
  let instant = wallMidnight - zoneOffsetMs(wallMidnight, timezone);
  instant = wallMidnight - zoneOffsetMs(instant, timezone);
  return new Date(instant);
}

/** A cook as the ranking and the feed need it. */
export interface FriendsCook {
  countryId: string;
  createdAt: string;
}

/** A participant of the ranking: the user or a friend, with all their cooks. */
export interface LeaderboardParticipant {
  userId: string;
  firstName: string;
  photoUrl: string | null;
  cooks: readonly FriendsCook[];
}

export interface LeaderboardInput {
  me: LeaderboardParticipant;
  friends: readonly LeaderboardParticipant[];
  period: LeaderboardPeriod;
  now: Date;
  /** IANA time zone of the user who asks for the ranking. */
  timezone: string;
}

/**
 * The first cook of each country (the stamps), in the order of the given cooks; with equal
 * dates the earlier one in the list wins.
 */
export function firstStamps<T extends FriendsCook>(cooks: readonly T[]): T[] {
  const first = new Map<string, T>();
  for (const cook of cooks) {
    const known = first.get(cook.countryId);
    if (known === undefined || Date.parse(cook.createdAt) < Date.parse(known.createdAt))
      first.set(cook.countryId, cook);
  }
  return [...first.values()];
}

/**
 * `GET /friends/leaderboard` as the server builds it. «Всё время»: passed countries and all
 * cooks; «Эта неделя»: countries whose first stamp is in the current week (from Monday 00:00 in
 * the asking user's time zone) and the cooks of the week. Order: more countries, then more dishes,
 * then by name; equal countries and dishes share a place (1, 2, 2, 4). The user is always listed.
 */
export function buildLeaderboard({
  me,
  friends,
  period,
  now,
  timezone,
}: LeaderboardInput): LeaderboardResponse {
  const from = period === 'week' ? weekStart(now, timezone).getTime() : -Infinity;
  const inPeriod = (cook: FriendsCook) => Date.parse(cook.createdAt) >= from;
  const rows = [me, ...friends].map((participant) => ({
    userId: participant.userId,
    firstName: participant.firstName,
    photoUrl: participant.photoUrl,
    isMe: participant === me,
    countries: firstStamps(participant.cooks).filter(inPeriod).length,
    dishes: participant.cooks.filter(inPeriod).length,
  }));
  rows.sort(
    (a, b) =>
      b.countries - a.countries ||
      b.dishes - a.dishes ||
      a.firstName.localeCompare(b.firstName, 'ru') ||
      a.userId.localeCompare(b.userId),
  );
  const entries: LeaderboardEntry[] = [];
  rows.forEach((row, index) => {
    const previous = entries[index - 1];
    const tied = previous?.countries === row.countries && previous.dishes === row.dishes;
    entries.push({ ...row, place: tied ? previous.place : index + 1 });
  });
  return { period, entries };
}

/**
 * The latest stamps of friends (`GET /friends/feed`): the first cook of each country of each
 * friend, newest first, at most `limit`. Repeat cooks are not stamps and are left out.
 */
export function latestFriendStamps<T extends FriendsCook>(
  cooksByFriend: readonly (readonly T[])[],
  limit: number = FRIENDS_FEED_LIMIT,
): T[] {
  return cooksByFriend
    .flatMap((cooks) => firstStamps(cooks))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}
