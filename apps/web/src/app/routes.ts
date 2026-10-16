/** Paths of the mini app screens. */
export const ROUTES = {
  home: '/',
  onboarding: '/onboarding',
  /** Dish card (task 6). */
  dish: '/dishes/:id',
  /** Cooking mode of a dish (task 7). */
  cooking: '/dishes/:id/cook',
  /** Photo and stamp after cooking (task 8). */
  cooked: '/dishes/:id/done',
  /** Shopping list (task 11). */
  shopping: '/shopping',
  /** Map and passport (task 9). */
  map: '/map',
  /** A country of the passport: its dishes (task 9). */
  country: '/map/countries/:id',
  /** Friends (task 10). */
  friends: '/friends',
  /** Paywall (task 12); `?dish=<id>` — the dish to return to after the payment. */
  paywall: '/paywall',
  /** Profile and settings (task 13). */
  profile: '/profile',
  devUi: '/dev/ui',
} as const;

export const dishPath = (id: string) => `/dishes/${encodeURIComponent(id)}`;

export const cookingPath = (id: string) => `${dishPath(id)}/cook`;

export const cookedPath = (id: string) => `${dishPath(id)}/done`;

export const countryPath = (id: string) => `/map/countries/${encodeURIComponent(id)}`;

/** Id of the «Что не едите» block of the profile: `#exclusions` scrolls to it. */
export const PROFILE_EXCLUSIONS_ID = 'exclusions';

/** The profile scrolled to «Что не едите» (from the empty suggestions of the main screen). */
export const profileExclusionsPath = `${ROUTES.profile}#${PROFILE_EXCLUSIONS_ID}`;

export const paywallPath = (dishId?: string) =>
  dishId === undefined
    ? ROUTES.paywall
    : `${ROUTES.paywall}?${new URLSearchParams({ dish: dishId }).toString()}`;
