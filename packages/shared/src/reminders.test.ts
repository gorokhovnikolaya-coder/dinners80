import { describe, expect, it } from 'vitest';

import { dueReminderDate, localMinutes, parseReminderTime } from './reminders.ts';

const MOSCOW = 'Europe/Moscow';
const at = (iso: string) => new Date(iso);

describe('parseReminderTime', () => {
  it('reads HH:MM and Postgres HH:MM:SS', () => {
    expect(parseReminderTime('18:00')).toBe(18 * 60);
    expect(parseReminderTime('07:30:00')).toBe(7 * 60 + 30);
    expect(parseReminderTime('00:00')).toBe(0);
  });

  it('rejects malformed values', () => {
    for (const value of ['24:00', '7:30', '18:60', '', 'x'])
      expect(parseReminderTime(value)).toBeNull();
  });
});

describe('localMinutes', () => {
  it('counts minutes in the time zone', () => {
    expect(localMinutes(at('2026-10-16T15:05:00Z'), MOSCOW)).toBe(18 * 60 + 5);
    expect(localMinutes(at('2026-10-16T21:30:00Z'), MOSCOW)).toBe(30);
    expect(localMinutes(at('2026-10-16T15:05:00Z'), 'Asia/Vladivostok')).toBe(1 * 60 + 5);
  });
});

describe('dueReminderDate', () => {
  const schedule = { timezone: MOSCOW, reminderTime: '18:00:00', sentOn: null };

  it('is due at reminder_time of the local day', () => {
    expect(dueReminderDate(schedule, at('2026-10-16T15:00:00Z'))).toBe('2026-10-16');
  });

  it('is not due before the time', () => {
    expect(dueReminderDate(schedule, at('2026-10-16T14:59:00Z'))).toBeNull();
  });

  it('is sent late up to two hours, not later', () => {
    expect(dueReminderDate(schedule, at('2026-10-16T17:00:00Z'))).toBe('2026-10-16');
    expect(dueReminderDate(schedule, at('2026-10-16T17:01:00Z'))).toBeNull();
  });

  it('is sent once a local day', () => {
    const sent = { ...schedule, sentOn: '2026-10-16' };
    expect(dueReminderDate(sent, at('2026-10-16T15:30:00Z'))).toBeNull();
    expect(dueReminderDate(sent, at('2026-10-17T15:00:00Z'))).toBe('2026-10-17');
  });

  it('does not carry a late reminder over midnight', () => {
    const late = { ...schedule, reminderTime: '23:30' };
    expect(dueReminderDate(late, at('2026-10-16T20:45:00Z'))).toBe('2026-10-16');
    // 00:30 of the next day: a new day, the time has not come yet.
    expect(dueReminderDate(late, at('2026-10-16T21:30:00Z'))).toBeNull();
  });

  it('follows the user time zone', () => {
    const vladivostok = { ...schedule, timezone: 'Asia/Vladivostok' };
    // 18:00 in Vladivostok (UTC+10) is 08:00 UTC.
    expect(dueReminderDate(vladivostok, at('2026-10-16T08:00:00Z'))).toBe('2026-10-16');
    expect(dueReminderDate(vladivostok, at('2026-10-16T15:00:00Z'))).toBeNull();
  });

  it('skips an unknown time zone or time', () => {
    expect(dueReminderDate({ ...schedule, timezone: 'Mars/Base' }, at('2026-10-16T15:00:00Z'))).toBeNull();
    expect(dueReminderDate({ ...schedule, reminderTime: 'x' }, at('2026-10-16T15:00:00Z'))).toBeNull();
  });
});
