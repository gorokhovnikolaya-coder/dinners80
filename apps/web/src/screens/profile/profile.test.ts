import { describe, expect, it } from 'vitest';

import { createAutosave, mergePatches, withoutFields, type ProfilePatch } from './autosave.ts';
import {
  DEV_DOCUMENT_URLS,
  documentLinks,
  exclusionsPatch,
  reminderView,
  subscriptionView,
  withTimeZone,
} from './profile.ts';

const NOW = new Date('2026-10-08T18:00:00+03:00');

describe('subscriptionView', () => {
  it('shows an active subscription with its end date', () => {
    expect(
      subscriptionView({ active: true, plan: 'year', expiresAt: '2027-10-08T15:00:00Z' }, NOW),
    ).toEqual({ kind: 'active', expiresAt: '2027-10-08T15:00:00Z' });
    expect(subscriptionView({ active: true, plan: 'month', expiresAt: null }, NOW)).toEqual({
      kind: 'active',
      expiresAt: null,
    });
  });

  it('tells an ended subscription from never paid', () => {
    expect(
      subscriptionView({ active: false, plan: 'month', expiresAt: '2026-09-28T15:00:00Z' }, NOW),
    ).toEqual({ kind: 'expired', expiresAt: '2026-09-28T15:00:00Z' });
    expect(subscriptionView({ active: false, plan: null, expiresAt: null }, NOW)).toEqual({
      kind: 'free',
    });
  });

  it('treats an inactive period that has not ended (refunded) as free', () => {
    expect(
      subscriptionView({ active: false, plan: 'year', expiresAt: '2027-01-01T00:00:00Z' }, NOW),
    ).toEqual({ kind: 'free' });
  });
});

describe('reminderView', () => {
  it('is on only if enabled and the bot may write', () => {
    expect(reminderView({ reminderEnabled: true, botCanWrite: true }, false, true)).toEqual({
      checked: true,
      needsWriteAccess: false,
      unavailable: false,
    });
    expect(reminderView({ reminderEnabled: false, botCanWrite: true }, false, true)).toEqual({
      checked: false,
      needsWriteAccess: false,
      unavailable: false,
    });
  });

  it('shows enabled reminders of a bot that cannot write as off, asking again on turn on', () => {
    expect(reminderView({ reminderEnabled: true, botCanWrite: false }, false, true)).toEqual({
      checked: false,
      needsWriteAccess: true,
      unavailable: false,
    });
  });

  it('trusts the permission given in this session before the server knows it', () => {
    expect(reminderView({ reminderEnabled: true, botCanWrite: false }, true, true)).toEqual({
      checked: true,
      needsWriteAccess: false,
      unavailable: false,
    });
  });

  it('is unavailable if the bot cannot write and the client cannot ask', () => {
    expect(reminderView({ reminderEnabled: false, botCanWrite: false }, false, false)).toEqual({
      checked: false,
      needsWriteAccess: true,
      unavailable: true,
    });
    // A bot that may write needs no request: an old client still turns reminders on.
    expect(
      reminderView({ reminderEnabled: false, botCanWrite: true }, false, false).unavailable,
    ).toBe(false);
  });
});

describe('exclusionsPatch', () => {
  const current = { exclusions: ['meat' as const], customExclusions: ['кинза'] };

  it('sends only the changed part, normalised', () => {
    expect(
      exclusionsPatch(current, { exclusions: ['gluten', 'meat'], customExclusions: ['кинза'] }),
    ).toEqual({ exclusions: ['meat', 'gluten'] });
    expect(
      exclusionsPatch(current, { exclusions: ['meat'], customExclusions: ['кинза', 'Грибы '] }),
    ).toEqual({ customExclusions: ['кинза', 'грибы'] });
    expect(exclusionsPatch(current, { exclusions: [], customExclusions: [] })).toEqual({
      exclusions: [],
      customExclusions: [],
    });
  });

  it('is null when nothing changed', () => {
    expect(exclusionsPatch(current, { exclusions: ['meat'], customExclusions: ['кинза'] })).toBe(
      null,
    );
  });
});

describe('withTimeZone', () => {
  it('adds the device zone only when it differs from the stored one', () => {
    expect(withTimeZone({ reminderEnabled: true }, 'Europe/Moscow', 'Asia/Tbilisi')).toEqual({
      reminderEnabled: true,
      timezone: 'Asia/Tbilisi',
    });
    expect(withTimeZone({ reminderTime: '19:00' }, 'Europe/Moscow', 'Europe/Moscow')).toEqual({
      reminderTime: '19:00',
    });
    expect(withTimeZone({ reminderTime: '19:00' }, 'Europe/Moscow', undefined)).toEqual({
      reminderTime: '19:00',
    });
  });
});

describe('documentLinks', () => {
  const terms = 'https://telegra.ph/Terms-10-16';
  const privacy = 'https://tma80.example/privacy';

  it('takes the https pages of the build', () => {
    expect(documentLinks({ terms, privacy, dev: false })).toEqual([
      { kind: 'terms', url: terms },
      { kind: 'privacy', url: privacy },
    ]);
  });

  it('hides a missing or broken one in production, uses a placeholder in dev', () => {
    expect(documentLinks({ terms, privacy: undefined, dev: false })).toEqual([
      { kind: 'terms', url: terms },
    ]);
    expect(documentLinks({ terms: 'http://plain.example', privacy: 'nope', dev: false })).toEqual(
      [],
    );
    expect(documentLinks({ terms: undefined, privacy: '', dev: true })).toEqual([
      { kind: 'terms', url: DEV_DOCUMENT_URLS.terms },
      { kind: 'privacy', url: DEV_DOCUMENT_URLS.privacy },
    ]);
  });
});

describe('mergePatches / withoutFields', () => {
  it('merges with later fields winning, ignoring undefined', () => {
    expect(mergePatches(null, { household: 'solo' })).toEqual({ household: 'solo' });
    expect(mergePatches({ household: 'solo' }, null)).toEqual({ household: 'solo' });
    expect(
      mergePatches(
        { household: 'solo', reminderEnabled: true },
        { household: 'family', reminderTime: undefined },
      ),
    ).toEqual({ household: 'family', reminderEnabled: true });
  });

  it('drops the fields a newer change sets', () => {
    expect(
      withoutFields({ household: 'solo', weekdayMinutes: 20 }, { household: 'family' }),
    ).toEqual({ weekdayMinutes: 20 });
    expect(withoutFields({ household: 'solo' }, { household: 'family' })).toBe(null);
    expect(withoutFields({ reminderEnabled: false }, null)).toEqual({ reminderEnabled: false });
    expect(withoutFields(null, { household: 'family' })).toBe(null);
  });
});

/** A `send` whose requests the test resolves or rejects one by one. */
function controlledSend() {
  const calls: { patch: ProfilePatch; resolve: () => void; reject: () => void }[] = [];
  const send = (patch: ProfilePatch) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ patch, resolve, reject: () => { reject(new Error('500')); } });
    });
  return { calls, send };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createAutosave', () => {
  it('sends a change at once and shows it as pending until the server answers', async () => {
    const { calls, send } = controlledSend();
    const autosave = createAutosave(send);
    let notified = 0;
    autosave.subscribe(() => {
      notified += 1;
    });

    autosave.save({ household: 'solo' });
    expect(calls.map((call) => call.patch)).toEqual([{ household: 'solo' }]);
    expect(autosave.getSnapshot()).toEqual({ pending: { household: 'solo' }, failed: null });
    expect(notified).toBeGreaterThan(0);

    calls[0]?.resolve();
    await settle();
    expect(autosave.getSnapshot()).toEqual({ pending: null, failed: null });
  });

  it('sends one request at a time; changes made meanwhile go together next', async () => {
    const { calls, send } = controlledSend();
    const autosave = createAutosave(send);

    autosave.save({ household: 'solo' });
    autosave.save({ household: 'family' });
    autosave.save({ weekdayMinutes: 45 });
    expect(calls).toHaveLength(1);
    expect(autosave.getSnapshot().pending).toEqual({ household: 'family', weekdayMinutes: 45 });

    calls[0]?.resolve();
    await settle();
    expect(calls.map((call) => call.patch)).toEqual([
      { household: 'solo' },
      { household: 'family', weekdayMinutes: 45 },
    ]);
    expect(autosave.getSnapshot().pending).toEqual({ household: 'family', weekdayMinutes: 45 });

    calls[1]?.resolve();
    await settle();
    expect(autosave.getSnapshot()).toEqual({ pending: null, failed: null });
  });

  it('rolls a failed change back and sends it again on retry', async () => {
    const { calls, send } = controlledSend();
    const autosave = createAutosave(send);

    autosave.save({ reminderEnabled: true });
    calls[0]?.reject();
    await settle();
    expect(autosave.getSnapshot()).toEqual({ pending: null, failed: { reminderEnabled: true } });

    autosave.retry();
    expect(calls[1]?.patch).toEqual({ reminderEnabled: true });
    expect(autosave.getSnapshot()).toEqual({ pending: { reminderEnabled: true }, failed: null });
    calls[1]?.resolve();
    await settle();
    expect(autosave.getSnapshot()).toEqual({ pending: null, failed: null });
  });

  it('lets a newer change of the same field replace the failed one', async () => {
    const { calls, send } = controlledSend();
    const autosave = createAutosave(send);

    autosave.save({ household: 'solo', weekdayMinutes: 20 });
    // Changed again while the first request is in flight: it is not failed when that one fails.
    autosave.save({ household: 'family' });
    calls[0]?.reject();
    await settle();
    expect(autosave.getSnapshot().failed).toEqual({ weekdayMinutes: 20 });
    expect(calls[1]?.patch).toEqual({ household: 'family' });

    // A change made after the failure removes the field from the failed ones too.
    autosave.save({ weekdayMinutes: 30 });
    expect(autosave.getSnapshot().failed).toBe(null);
  });
});
