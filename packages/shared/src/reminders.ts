import { localDateKey } from './suggestions.ts';

/** How late a missed reminder may still go out (the worker was down at `reminder_time`). */
export const REMINDER_LATE_MINUTES = 120;

/** Share cards older than this are deleted by the worker (ТЗ, «Интеграция с Telegram»). */
export const SHARE_CARD_TTL_DAYS = 30;

/** Minutes since local midnight of `now` in the time zone. */
export function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: 'hour' | 'minute') =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

/** `HH:MM` or `HH:MM:SS` (Postgres `time`) → minutes since midnight; `null` if malformed. */
export function parseReminderTime(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface ReminderSchedule {
  /** IANA time zone of the user. */
  timezone: string;
  /** `users.reminder_time`: `HH:MM` or `HH:MM:SS`. */
  reminderTime: string;
  /** Local date `YYYY-MM-DD` of the last reminder, `null` — never sent. */
  sentOn: string | null;
}

/**
 * Whether the daily reminder is due at `now` (decision 0023): it is `reminder_time` or later in
 * the user's time zone, no more than `REMINDER_LATE_MINUTES` late, on the same local day, and no
 * reminder has been sent this local day. Returns the local date to mark as sent, or `null`.
 */
export function dueReminderDate(schedule: ReminderSchedule, now: Date): string | null {
  const at = parseReminderTime(schedule.reminderTime);
  if (at === null) return null;
  let today: string;
  let minutes: number;
  try {
    today = localDateKey(now, schedule.timezone);
    minutes = localMinutes(now, schedule.timezone);
  } catch {
    // An unknown time zone (the server validates it, so this is a broken row): skip the user.
    return null;
  }
  if (schedule.sentOn === today) return null;
  const late = minutes - at;
  return late >= 0 && late <= REMINDER_LATE_MINUTES ? today : null;
}
