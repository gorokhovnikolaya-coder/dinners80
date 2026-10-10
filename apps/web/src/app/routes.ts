/** Paths of the mini app screens. */
export const ROUTES = {
  home: '/',
  onboarding: '/onboarding',
  /** Dish card (task 6). */
  dish: '/dishes/:id',
  /** Map and passport (task 9). */
  map: '/map',
  /** Friends (task 10). */
  friends: '/friends',
  /** Paywall (task 12); `?dish=<id>` — the dish to return to after the payment. */
  paywall: '/paywall',
  /** Profile and settings (task 13). */
  profile: '/profile',
  devUi: '/dev/ui',
} as const;

export const dishPath = (id: string) => `/dishes/${encodeURIComponent(id)}`;

export const paywallPath = (dishId?: string) =>
  dishId === undefined
    ? ROUTES.paywall
    : `${ROUTES.paywall}?${new URLSearchParams({ dish: dishId }).toString()}`;
