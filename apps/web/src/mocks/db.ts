import {
  cookSchema,
  hasOnboardingAnswers,
  normalizeCustomExclusions,
  normalizeExclusions,
  subscriptionPeriod,
  subscriptionStatusSchema,
  updateMeRequestSchema,
  type AddShoppingRequest,
  type Cook,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type UpdateMeRequest,
  type UserProfile,
} from '@tma80/shared';

import { cooks as fixtureCooks } from './fixtures/cooks.ts';
import { shoppingFixtures } from './fixtures/shopping.ts';
import { findUserByTgId } from './fixtures/users.ts';

/** What the mock backend knows about a user now: the fixture plus changes made in this session. */
export interface MockUser {
  profile: UserProfile;
  /** `users.onboarded_at IS NOT NULL`. */
  onboarded: boolean;
  subscription: SubscriptionStatus;
  /** The fixture cooks plus the ones recorded in this session (`POST /cooks`), oldest first. */
  cooks: readonly Cook[];
}

/** An item of the user's shopping list (`shopping_items`): an ingredient of a dish to buy. */
export interface MockShoppingItem {
  id: string;
  dishId: string;
  /** `dish_ingredients.key` within the dish. */
  ingredientKey: string;
  servings: number;
  checked: boolean;
  /** ISO 8601. */
  createdAt: string;
}

/**
 * A changed user as stored: only the applied `PATCH /me` fields, the onboarding flag, the
 * shopping list, the cooks recorded in the session and the subscription paid in it. The profile
 * is rebuilt from the current fixture, so later fixture edits are not masked.
 */
interface StoredUser {
  patch: UpdateMeRequest;
  onboarded: boolean;
  shopping: MockShoppingItem[];
  cooks: Cook[];
  /** Set by a payment in this session; the fixture subscription otherwise. */
  subscription?: SubscriptionStatus;
}

/** An invoice created by `POST /payments/invoice`, waiting for the payment. */
interface MockInvoice {
  tgId: number;
  plan: SubscriptionPlan;
}

const isShoppingItem = (value: unknown): value is MockShoppingItem => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<MockShoppingItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.dishId === 'string' &&
    typeof item.ingredientKey === 'string' &&
    typeof item.servings === 'number' &&
    typeof item.checked === 'boolean' &&
    typeof item.createdAt === 'string'
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
    const { patch, onboarded, shopping, cooks, subscription } = value as Partial<StoredUser>;
    // A user changed only by the shopping list or cooks has an empty patch, which the
    // `PATCH /me` schema (at least one field) rejects.
    const empty = JSON.stringify(patch) === '{}';
    const parsed = empty
      ? { success: true as const, data: {} }
      : updateMeRequestSchema.safeParse(patch);
    if (parsed.success && typeof onboarded === 'boolean') {
      const items: unknown[] = Array.isArray(shopping) ? shopping : [];
      const paid = subscriptionStatusSchema.safeParse(subscription);
      users.set(Number(key), {
        patch: parsed.data,
        onboarded,
        shopping: items.filter(isShoppingItem),
        cooks: (Array.isArray(cooks) ? (cooks as unknown[]) : []).flatMap((cook) => {
          const restored = cookSchema.safeParse(cook);
          return restored.success ? [restored.data] : [];
        }),
        ...(paid.success ? { subscription: paid.data } : {}),
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
  /** Open invoices by slug; they live as long as the page (paid right after being opened). */
  const invoices = new Map<string, MockInvoice>();

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
      subscription: stored?.subscription ?? fixture.subscription,
      cooks: [
        ...fixtureCooks.filter((cook) => cook.userId === fixture.profile.id),
        ...(stored?.cooks ?? []),
      ],
    };
  };

  /** The stored entry of a user, created from the current state on first change. */
  const entryOf = (tgId: number, user: MockUser): StoredUser => {
    let entry = changed.get(tgId);
    if (!entry) {
      entry = {
        patch: {},
        onboarded: user.onboarded,
        shopping: (shoppingFixtures[tgId] ?? []).map((item) => ({ ...item })),
        cooks: [],
      };
      changed.set(tgId, entry);
    }
    return entry;
  };

  /** `PATCH /me` as the server does it: normalised exclusions, `onboarded_at` set once. */
  const updateUser = (tgId: number, patch: UpdateMeRequest): MockUser | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const entry = entryOf(tgId, user);
    const profile = applyPatch(user.profile, patch);
    const onboarded = user.onboarded || hasOnboardingAnswers(profile);
    entry.patch = mergePatches(entry.patch, patch);
    entry.onboarded = onboarded;
    persist();
    return { ...user, profile, onboarded };
  };

  /** The user's shopping list: the fixture one until it is changed in this session. */
  const getShopping = (tgId: number): readonly MockShoppingItem[] =>
    changed.get(tgId)?.shopping ?? shoppingFixtures[tgId] ?? [];

  /**
   * `POST /shopping` as the server does it: the dish's unchecked items are replaced with the sent
   * ingredients (no duplicates when a dish is added again); bought items stay.
   * @returns the number of the dish's items added, or `undefined` for an unknown user.
   */
  const addShopping = (
    tgId: number,
    request: AddShoppingRequest,
    now = new Date(),
  ): number | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const entry = entryOf(tgId, user);
    const kept = entry.shopping.filter((item) => item.dishId !== request.dishId || item.checked);
    const added = request.ingredientKeys.map((ingredientKey) => ({
      id: crypto.randomUUID(),
      dishId: request.dishId,
      ingredientKey,
      servings: request.servings,
      checked: false,
      createdAt: now.toISOString(),
    }));
    entry.shopping = [...kept, ...added];
    persist();
    return added.length;
  };

  /** Records a cook (`POST /cooks`); access and the daily limit are checked by the handler. */
  const addCook = (
    tgId: number,
    cook: Pick<Cook, 'dishId' | 'countryId' | 'photoPath'>,
    now = new Date(),
  ): Cook | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const record: Cook = {
      id: crypto.randomUUID(),
      userId: user.profile.id,
      ...cook,
      createdAt: now.toISOString(),
    };
    entryOf(tgId, user).cooks.push(record);
    persist();
    return record;
  };

  /**
   * `PATCH /shopping/:id`: marks the user's item bought or not.
   * @returns the changed item, or `undefined` if the user has no such item.
   */
  const setShoppingChecked = (
    tgId: number,
    id: string,
    checked: boolean,
  ): MockShoppingItem | undefined => {
    const user = getUser(tgId);
    if (!user || !getShopping(tgId).some((item) => item.id === id)) return undefined;
    const item = entryOf(tgId, user).shopping.find((candidate) => candidate.id === id);
    if (!item) return undefined;
    item.checked = checked;
    persist();
    return item;
  };

  /**
   * `DELETE /shopping/checked`: removes the user's bought items.
   * @returns how many were removed, or `undefined` for an unknown user.
   */
  const clearCheckedShopping = (tgId: number): number | undefined => {
    const user = getUser(tgId);
    if (!user) return undefined;
    const entry = entryOf(tgId, user);
    const kept = entry.shopping.filter((item) => !item.checked);
    const removed = entry.shopping.length - kept.length;
    entry.shopping = kept;
    persist();
    return removed;
  };

  /**
   * `POST /payments/invoice`: an invoice for the plan (the server calls `createInvoiceLink`).
   * @returns the invoice slug (`https://t.me/$<slug>`), or `undefined` for an unknown user.
   */
  const createInvoice = (tgId: number, plan: SubscriptionPlan): string | undefined => {
    if (!getUser(tgId)) return undefined;
    const slug = `mock-${plan}-${crypto.randomUUID()}`;
    invoices.set(slug, { tgId, plan });
    return slug;
  };

  /**
   * A successful payment of the invoice, as the bot webhook records it (`successful_payment`):
   * the paid period starts now or, while a subscription is active, when it ends. A repeated
   * payment of the same invoice changes nothing (idempotent).
   * @returns the user's subscription after the payment, or `undefined` for an unknown invoice.
   */
  const completePayment = (slug: string, now = new Date()): SubscriptionStatus | undefined => {
    const invoice = invoices.get(slug);
    const user = invoice && getUser(invoice.tgId);
    if (!invoice || !user) return undefined;
    invoices.delete(slug);
    const current = user.subscription;
    const period = subscriptionPeriod(invoice.plan, current.active ? current.expiresAt : null, now);
    const subscription: SubscriptionStatus = {
      active: true,
      plan: invoice.plan,
      expiresAt: period.expiresAt.toISOString(),
    };
    entryOf(invoice.tgId, user).subscription = subscription;
    persist();
    return subscription;
  };

  return {
    getUser,
    updateUser,
    createInvoice,
    completePayment,
    getShopping,
    addShopping,
    setShoppingChecked,
    clearCheckedShopping,
    addCook,
  };
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
