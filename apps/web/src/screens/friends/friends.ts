import { localDateKey, type LeaderboardEntry } from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';
import { formatStampDate } from '../map/passport.ts';

const t = ru.friends.feed.time;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const dayKey = (date: Date, timezone: string) => {
  try {
    return localDateKey(date, timezone);
  } catch {
    return localDateKey(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
};

/**
 * When a stamp of the feed happened, in the user's time zone: «только что» (under a minute),
 * «N мин назад» (under an hour), «N ч назад» (today), «вчера», then the date «12 октября» (with
 * the year if not the current one). A time slightly in the future (clock skew) is «только что».
 */
export function formatFeedTime(iso: string, now: Date, timezone: string): string {
  const date = new Date(iso);
  const ago = now.getTime() - date.getTime();
  if (ago < MINUTE_MS) return t.justNow;
  if (ago < HOUR_MS) return t.minutes(Math.floor(ago / MINUTE_MS));
  const day = dayKey(date, timezone);
  if (day === dayKey(now, timezone)) return t.hours(Math.floor(ago / HOUR_MS));
  if (day === dayKey(new Date(now.getTime() - DAY_MS), timezone)) return t.yesterday;
  return formatStampDate(iso, timezone, now);
}

/** The ranking has someone besides the user; otherwise the screen shows the invite. */
export function hasFriends(entries: readonly LeaderboardEntry[]): boolean {
  return entries.some((entry) => !entry.isMe);
}
