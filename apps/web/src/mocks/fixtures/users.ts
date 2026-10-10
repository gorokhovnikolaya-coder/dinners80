import { DEFAULT_REMINDER_TIME, type SubscriptionStatus, type UserProfile } from '@tma80/shared';

/** Telegram user as it comes in initData (`user` field, snake_case). */
export interface TelegramUserFixture {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code: string;
  allows_write_to_pm: boolean;
  photo_url?: string;
}

/** A user of the mock backend: what Telegram sends and what the server stores. */
export interface UserFixture {
  /** Dev-only description of the state, for logs and docs. */
  state: string;
  tg: TelegramUserFixture;
  profile: UserProfile;
  onboarded: boolean;
  subscription: SubscriptionStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_SUBSCRIPTION: SubscriptionStatus = { active: false, plan: null, expiresAt: null };

const uuid = (tgId: number) => `00000000-0000-4000-8000-${String(tgId).padStart(12, '0')}`;

type ProfileSettings = Pick<
  UserProfile,
    | 'household'
  | 'weekdayMinutes'
  | 'exclusions'
  | 'customExclusions'
  | 'reminderEnabled'
  | 'botCanWrite'
>;

const makeUser = (
  state: string,
  tg: Omit<TelegramUserFixture, 'language_code'>,
  settings: ProfileSettings,
  options: { onboarded?: boolean; subscription?: SubscriptionStatus } = {},
): UserFixture => ({
  state,
  tg: { ...tg, language_code: 'ru' },
  profile: {
    id: uuid(tg.id),
    tgId: tg.id,
    firstName: tg.first_name,
    username: tg.username ?? null,
    photoUrl: tg.photo_url ?? null,
    timezone: 'Europe/Moscow',
    reminderTime: DEFAULT_REMINDER_TIME,
    inviteCode: `inv${String(tg.id)}`,
    ...settings,
  },
  onboarded: options.onboarded ?? true,
  subscription: options.subscription ?? NO_SUBSCRIPTION,
});

/** Test user ids for `?user=<id>` (Telegram ids in the mock initData). */
export const TEST_USER_IDS = {
  newbie: 1001,
  eightCountries: 1002,
  tenCountriesFree: 1003,
  tenCountriesSubscribed: 1004,
  botCannotWrite: 1005,
} as const;

/** Friends of the test users; they can also be opened with `?user=<id>`. */
export const FRIEND_IDS = { egor: 2001, zhanna: 2002, zoya: 2003 } as const;

/** Used when the URL has no `?user=` and nothing was chosen earlier in the tab. */
export const DEFAULT_TEST_USER_ID = TEST_USER_IDS.eightCountries;

const subscribed = (days: number, plan: 'month' | 'year'): SubscriptionStatus => ({
  active: true,
  plan,
  expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
});

export const users: UserFixture[] = [
  makeUser(
    'новичок',
    { id: TEST_USER_IDS.newbie, first_name: 'Аня', username: 'anya_new', allows_write_to_pm: true },
    {
      household: null,
      weekdayMinutes: null,
      exclusions: [],
      customExclusions: [],
      reminderEnabled: false,
      botCanWrite: true,
    },
    { onboarded: false },
  ),
  makeUser(
    '8 стран',
    {
      id: TEST_USER_IDS.eightCountries,
      first_name: 'Борис',
      last_name: 'Петров',
      username: 'boris_cook',
      allows_write_to_pm: true,
    },
    {
      household: 'couple',
      weekdayMinutes: 30,
      exclusions: [],
      customExclusions: ['свинина'],
      reminderEnabled: true,
      botCanWrite: true,
    },
  ),
  makeUser(
    '10 стран без подписки',
    { id: TEST_USER_IDS.tenCountriesFree, first_name: 'Вера', allows_write_to_pm: true },
    {
      household: 'family',
      weekdayMinutes: 45,
      exclusions: [],
      customExclusions: [],
      reminderEnabled: true,
      botCanWrite: true,
    },
  ),
  makeUser(
    '10 стран с подпиской',
    {
      id: TEST_USER_IDS.tenCountriesSubscribed,
      first_name: 'Глеб',
      username: 'gleb',
      allows_write_to_pm: true,
    },
    {
      household: 'solo',
      weekdayMinutes: 20,
      exclusions: [],
      customExclusions: ['свинина'],
      reminderEnabled: true,
      botCanWrite: true,
    },
    { subscription: subscribed(20, 'month') },
  ),
  makeUser(
    'бот не может писать',
    { id: TEST_USER_IDS.botCannotWrite, first_name: 'Дина', allows_write_to_pm: false },
    {
      household: 'couple',
      weekdayMinutes: 30,
      exclusions: ['meat'],
      customExclusions: [],
      reminderEnabled: false,
      botCanWrite: false,
    },
  ),
  makeUser(
    'друг, 5 стран',
    { id: FRIEND_IDS.egor, first_name: 'Егор', allows_write_to_pm: true },
    {
      household: 'solo',
      weekdayMinutes: 30,
      exclusions: [],
      customExclusions: [],
      reminderEnabled: true,
      botCanWrite: true,
    },
  ),
  makeUser(
    'друг, 8 стран, без глютена',
    { id: FRIEND_IDS.zhanna, first_name: 'Жанна', username: 'zhanna', allows_write_to_pm: true },
    {
      household: 'family',
      weekdayMinutes: 45,
      exclusions: ['gluten'],
      customExclusions: [],
      reminderEnabled: false,
      botCanWrite: true,
    },
  ),
  makeUser(
    'друг, 11 стран, подписка',
    { id: FRIEND_IDS.zoya, first_name: 'Зоя', allows_write_to_pm: true },
    {
      household: 'couple',
      weekdayMinutes: 45,
      exclusions: [],
      customExclusions: [],
      reminderEnabled: true,
      botCanWrite: true,
    },
    { subscription: subscribed(300, 'year') },
  ),
];

export const findUserByTgId = (tgId: number): UserFixture | undefined =>
  users.find((user) => user.tg.id === tgId);

/** Friendships by Telegram id; the server stores two rows per pair. */
export const friendships: readonly (readonly [number, number])[] = [
  [TEST_USER_IDS.eightCountries, FRIEND_IDS.egor],
  [TEST_USER_IDS.eightCountries, FRIEND_IDS.zhanna],
  [TEST_USER_IDS.eightCountries, FRIEND_IDS.zoya],
  [TEST_USER_IDS.tenCountriesFree, FRIEND_IDS.egor],
  [TEST_USER_IDS.tenCountriesFree, FRIEND_IDS.zhanna],
  [TEST_USER_IDS.tenCountriesFree, FRIEND_IDS.zoya],
  [TEST_USER_IDS.tenCountriesSubscribed, FRIEND_IDS.egor],
  [TEST_USER_IDS.tenCountriesSubscribed, FRIEND_IDS.zhanna],
  [TEST_USER_IDS.tenCountriesSubscribed, FRIEND_IDS.zoya],
  [TEST_USER_IDS.botCannotWrite, FRIEND_IDS.egor],
];
