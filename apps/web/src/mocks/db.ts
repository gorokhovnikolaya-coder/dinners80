import {
  hasOnboardingAnswers,
  normalizeCustomExclusions,
  normalizeExclusions,
  updateMeRequestSchema,
  type AddShoppingRequest,
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

/** An item of the user's shopping list (`shopping_items`): an ingredient of a dish to buy. */
export interface MockShoppingItem {
  id: string;
  dishId: string;
  /** `dish_ingredients.key` within the dish. */
  ingredientKey: string;
  servings: number;
  checked: boolean;
}

/**
 * A changed user as stored: only the applied `PATCH /me` fields, the onboarding flag and the
 * shopping list. The profile is rebuilt from the current fixture, so later fixture edits are not
 * masked.
 */
interface StoredUser {
  patch: UpdateMeRequest;
  onboarded: boolean;
  shopping: MockShoppingItem[];
}

const isShoppingItem = (value: unknown): value is MockShoppingItem => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<MockShoppingItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.dishId === 'string' &&
    typeof item.ingredientKey === 'string' &&
    typeof item.servings === 'number' &&
    typeof item.checked === 'boolean'
  );
};

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
    const { patch, onboarded, shopping } = value as Partial<StoredUser>;
    const parsed = updateMeRequestSchema.safeParse(patch);
    if (parsed.success && typeof onboarded === 'boolean') {
      const items: unknown[] = Array.isArray(shopping) ? shopping : [];
      users.set(Number(key), {
        patch: parsed.data,
        onboarded,
        shopping: items.filter(isShoppingItem),
      });
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
    const shopping = changed.get(tgId)?.shopping ?? [];
    changed.set(tgId, { patch: mergePatches(previous, patch), onboarded, shopping });
    persist();
    return { ...user, profile, onboarded };
  };

  /** The user's shopping list (empty in the fixtures). */
  const getShopping = (tgId: number): readonly MockShoppingItem[] =>
    changed.get(tgId)?.shopping ?? [];

  /**
   * `POST /shopping` as the server does it: the dish's unchecked items are replaced with the sent
   * ingredients (no duplicates when a dish is added again); bought items stay.
   * @returns the number of the dish's items added, or `undefined` for an unknown user.
   */
  const addShopping = (tgId: number, request: AddShoppingRequest): number | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const stored = changed.get(tgId);
    const kept = (stored?.shopping ?? []).filter(
      (item) => item.dishId !== request.dishId || item.checked,
    );
    const added = request.ingredientKeys.map((ingredientKey) => ({
      id: crypto.randomUUID(),
      dishId: request.dishId,
      ingredientKey,
      servings: request.servings,
      checked: false,
    }));
    changed.set(tgId, {
      patch: stored?.patch ?? {},
      onboarded: stored?.onboarded ?? user.onboarded,
      shopping: [...kept, ...added],
    });
    persist();
    return added.length;
  };

  return { getUser, updateUser, getShopping, addShopping };
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
