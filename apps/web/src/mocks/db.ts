import {
  hasOnboardingAnswers,
  normalizeCustomExclusions,
  normalizeExclusions,
  updateMeRequestSchema,
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

/**
 * A changed user as stored: only the applied `PATCH /me` fields and the onboarding flag. The
 * profile is rebuilt from the current fixture, so later fixture edits are not masked.
 */
interface StoredUser {
  patch: UpdateMeRequest;
  onboarded: boolean;
}

/** Where changed users are kept between page loads (sessionStorage in the browser). */
export interface MockDbStorage {
  load(): unknown;
  save(data: Record<string, StoredUser>): void;
}

/** Restores saved users, dropping anything that no longer matches the `PATCH /me` schema. */
const restore = (data: unknown): Map<number, StoredUser> => {
  const users = new Map<number, StoredUser>();
  if (typeof data !== 'object' || data === null) return users;
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null) continue;
    const { patch, onboarded } = value as Partial<StoredUser>;
    const parsed = updateMeRequestSchema.safeParse(patch);
    if (parsed.success && typeof onboarded === 'boolean') {
      users.set(Number(key), { patch: parsed.data, onboarded });
    }
  }
  return users;
};

/** Profile with the patch applied; exclusions are stored normalised, as the server does. */
const applyPatch = (profile: UserProfile, patch: UpdateMeRequest): UserProfile => ({
  ...profile,
  household: patch.household ?? profile.household,
  weekdayMinutes: patch.weekdayMinutes ?? profile.weekdayMinutes,
  exclusions: patch.exclusions ? normalizeExclusions(patch.exclusions) : profile.exclusions,
  customExclusions: patch.customExclusions
    ? normalizeCustomExclusions(patch.customExclusions)
    : profile.customExclusions,
  timezone: patch.timezone ?? profile.timezone,
  reminderEnabled: patch.reminderEnabled ?? profile.reminderEnabled,
  reminderTime: patch.reminderTime ?? profile.reminderTime,
});

/** Later fields win; undefined fields do not erase earlier ones. */
const mergePatches = (earlier: UpdateMeRequest, later: UpdateMeRequest): UpdateMeRequest => ({
  ...earlier,
  ...Object.fromEntries(Object.entries(later).filter(([, value]) => value !== undefined)),
});

/**
 * In-memory state of the mock backend. Fixtures are never mutated: the applied patches are kept
 * separately and, if `storage` is given, persisted so a page reload («reopening» the mini app in
 * the same tab) sees them.
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
      profile: stored ? applyPatch(fixture.profile, stored.patch) : fixture.profile,
      onboarded: stored?.onboarded ?? fixture.onboarded,
      subscription: fixture.subscription,
    };
  };

  /** `PATCH /me` as the server does it: normalised exclusions, `onboarded_at` set once. */
  const updateUser = (tgId: number, patch: UpdateMeRequest): MockUser | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const previous = changed.get(tgId)?.patch ?? {};
    const profile = applyPatch(user.profile, patch);
    const onboarded = user.onboarded || hasOnboardingAnswers(profile);
    changed.set(tgId, { patch: mergePatches(previous, patch), onboarded });
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
