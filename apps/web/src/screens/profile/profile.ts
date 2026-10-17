import {
  type ClientEvent,
  normalizeCustomExclusions,
  normalizeExclusions,
  type SubscriptionStatus,
  type UpdateMeRequest,
  type UserProfile,
} from '@tma80/shared';

import type { ExclusionsValue } from '../../components/preferences/exclusions.ts';

/** The subscription block of the profile. */
export type SubscriptionView =
  | { kind: 'active'; expiresAt: string | null }
  | { kind: 'expired'; expiresAt: string }
  | { kind: 'free' };

/**
 * Active — until its end date; ended — the date it ended (the last paid period is in the past);
 * otherwise (never paid, refunded) — the free plan. Both inactive kinds offer the paywall.
 */
export function subscriptionView(subscription: SubscriptionStatus, now: Date): SubscriptionView {
  if (subscription.active) return { kind: 'active', expiresAt: subscription.expiresAt };
  const { expiresAt } = subscription;
  if (expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime()) {
    return { kind: 'expired', expiresAt };
  }
  return { kind: 'free' };
}

/** The reminder switch and what it may do. */
export interface ReminderView {
  /** On only if reminders will really come: enabled and the bot may write to the user. */
  checked: boolean;
  /** Turning it on first asks Telegram to let the bot write (`requestWriteAccess`). */
  needsWriteAccess: boolean;
  /** The bot may not write and this client cannot ask (Mini Apps < 6.9): update Telegram. */
  unavailable: boolean;
}

/**
 * The reminder switch shows the actual state: enabled in the profile but the bot cannot write
 * (blocked, never allowed) is «off», and turning it on asks for the permission again.
 * @param writeAccessAllowed - the user allowed it in this session (the server may not know yet).
 * @param canRequest - the client has `requestWriteAccess`.
 */
export function reminderView(
  profile: Pick<UserProfile, 'reminderEnabled' | 'botCanWrite'>,
  writeAccessAllowed: boolean,
  canRequest: boolean,
): ReminderView {
  const canWrite = profile.botCanWrite || writeAccessAllowed;
  return {
    checked: profile.reminderEnabled && canWrite,
    needsWriteAccess: !canWrite,
    unavailable: !canWrite && !canRequest,
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * `PATCH /me` for a change of «Что не едите»: only the part that changed (tags or own words),
 * normalised as the server stores it; `null` if nothing changed.
 */
export function exclusionsPatch(
  current: ExclusionsValue,
  next: ExclusionsValue,
): UpdateMeRequest | null {
  const exclusions = normalizeExclusions(next.exclusions);
  const customExclusions = normalizeCustomExclusions(next.customExclusions);
  const patch: UpdateMeRequest = {
    ...(sameList(exclusions, current.exclusions) ? {} : { exclusions }),
    ...(sameList(customExclusions, current.customExclusions) ? {} : { customExclusions }),
  };
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * A reminder change with the device's time zone if it differs from the stored one: the reminder
 * comes at `reminderTime` in the user's zone, and the user may have moved since the onboarding.
 * @param deviceZone - `detectTimeZone()`: `undefined` if the device reports no valid zone.
 */
export function withTimeZone(
  patch: UpdateMeRequest,
  storedZone: string,
  deviceZone: string | undefined,
): UpdateMeRequest {
  return deviceZone !== undefined && deviceZone !== storedZone
    ? { ...patch, timezone: deviceZone }
    : patch;
}

/** A document linked from the profile. */
export interface DocumentLink {
  kind: 'terms' | 'privacy';
  url: string;
}

/** Placeholders of the documents in `npm run dev` (their texts are an open question of the ТЗ). */
export const DEV_DOCUMENT_URLS = {
  terms: 'https://example.com/tma80/terms',
  privacy: 'https://example.com/tma80/privacy',
} as const;

const httpsUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Links to the terms and the privacy policy from the build variables (`VITE_TERMS_URL`,
 * `VITE_PRIVACY_URL`, https only). In dev a missing one is a placeholder; a production build
 * hides it rather than link to nowhere.
 */
export function documentLinks(env: {
  terms: string | undefined;
  privacy: string | undefined;
  dev: boolean;
}): DocumentLink[] {
  const kinds = ['terms', 'privacy'] as const;
  return kinds.flatMap((kind) => {
    const url = httpsUrl(env[kind]) ?? (env.dev ? DEV_DOCUMENT_URLS[kind] : undefined);
    return url === undefined ? [] : [{ kind, url }];
  });
}

/**
 * `reminder_toggled` for a saved `PATCH /me` (decision 0024): when the reminder was turned on or
 * off or its time changed — with the saved state; `null` for other changes.
 */
export function reminderToggledEvent(
  patch: UpdateMeRequest,
  saved: Pick<UserProfile, 'reminderEnabled' | 'reminderTime'>,
): ClientEvent | null {
  if (patch.reminderEnabled === undefined && patch.reminderTime === undefined) return null;
  return {
    name: 'reminder_toggled',
    props: { enabled: saved.reminderEnabled, time: saved.reminderTime },
  };
}
