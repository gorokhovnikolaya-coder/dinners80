import {
  hasOnboardingAnswers,
  normalizeExclusions,
  userProfileSchema,
  type SubscriptionStatus,
  type UpdateMeRequest,
  type UserProfile,
} from '@tma80/shared';

import { findUserByTgId } from './fixtures/users.ts';

/** What the mock backend knows about a user now: the fixture plus changes made in this session. */
export interface MockUser {
  profile: UserProfile;
  /** `users.onboarded_at IS NOT NULL`. */
  onboarded: boolean;
  subscription: SubscriptionStatus;
}

interface StoredUser {
  profile: UserProfile;
  onboarded: boolean;
}

/** Where changed users are kept between page loads (sessionStorage in the browser). */
export interface MockDbStorage {
  load(): unknown;
  save(data: Record<string, StoredUser>): void;
}

/** Restores saved users, dropping anything that no longer matches the profile schema. */
const restore = (data: unknown): Map<number, StoredUser> => {
  const users = new Map<number, StoredUser>();
  if (typeof data !== 'object' || data === null) return users;
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null) continue;
    const { profile, onboarded } = value as Partial<StoredUser>;
    const parsed = userProfileSchema.safeParse(profile);
    if (parsed.success && typeof onboarded === 'boolean') {
      users.set(Number(key), { profile: parsed.data, onboarded });
    }
  }
  return users;
};

/**
 * In-memory state of the mock backend. Fixtures are never mutated: a changed user is copied into
 * the store and, if `storage` is given, persisted so a page reload («reopening» the mini app in
 * the same tab) sees it.
 */
export function createMockDb(storage?: MockDbStorage) {
  const changed = restore(storage?.load());

  const persist = () => {
    storage?.save(Object.fromEntries(changed));
  };

  const getUser = (tgId: number): MockUser | undefined => {
    const fixture = findUserByTgId(tgId);
    if (!fixture) return undefined;
    const stored = changed.get(tgId);
    return {
      profile: stored?.profile ?? fixture.profile,
      onboarded: stored?.onboarded ?? fixture.onboarded,
      subscription: fixture.subscription,
    };
  };

  /** `PATCH /me` as the server does it: normalised exclusions, `onboarded_at` set once. */
  const updateUser = (tgId: number, patch: UpdateMeRequest): MockUser | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const current = user.profile;
    const profile: UserProfile = {
      ...current,
      household: patch.household ?? current.household,
      weekdayMinutes: patch.weekdayMinutes ?? current.weekdayMinutes,
      exclusions: patch.exclusions ? normalizeExclusions(patch.exclusions) : current.exclusions,
      timezone: patch.timezone ?? current.timezone,
      reminderEnabled: patch.reminderEnabled ?? current.reminderEnabled,
      reminderTime: patch.reminderTime ?? current.reminderTime,
    };
    const onboarded = user.onboarded || hasOnboardingAnswers(profile);
    changed.set(tgId, { profile, onboarded });
    persist();
    return { ...user, profile, onboarded };
  };

  return { getUser, updateUser };
}

export type MockDb = ReturnType<typeof createMockDb>;

/** sessionStorage-backed storage: changes live as long as the tab, like the chosen test user. */
export function sessionMockDbStorage(key: string): MockDbStorage {
  return {
    load() {
      try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as unknown) : undefined;
      } catch {
        return undefined;
      }
    },
    save(data) {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Storage may be unavailable (private mode): changes then last until the page reloads.
      }
    },
  };
}
