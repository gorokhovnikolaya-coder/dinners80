import {
  AUTH_SCHEME,
  COOK_PHOTO_FIELD,
  COOK_PHOTO_MAX_BYTES,
  COOK_PHOTO_TYPE,
  COOKS_PER_DAY_LIMIT,
  addShoppingRequestSchema,
  createCookRequestSchema,
  findOvertakenFriend,
  clampServings,
  defaultServings,
  dishLabel,
  dishQuerySchema,
  hasCountryAccess,
  homeQuerySchema,
  scaleAmount,
  suggestDishes,
  updateMeRequestSchema,
  type AddShoppingResponse,
  type ApiError,
  type ApiErrorCode,
  type AuthResponse,
  type CreateCookResponse,
  type UploadCookPhotoResponse,
  type DishPreview,
  type DishResponse,
  type HomeResponse,
  type PaywallError,
  type MeResponse,
  type SuggestionCard,
} from '@tma80/shared';
import { HttpResponse, delay, http } from 'msw';

import { parseInitDataUserId } from '../telegram/mock/initData.ts';
import { NO_MOCK_CONTROLS, takeFailure, type MockControls } from './controls.ts';
import { createMockDb, type MockDb, type MockUser } from './db.ts';
import { countries } from './fixtures/countries.ts';
import { dishes, withIngredients } from './fixtures/dishes.ts';
import { mockDishImageUrl } from './fixtures/images.ts';
import { recipes } from './fixtures/recipes.ts';
import { friendships } from './fixtures/users.ts';

const apiError = (status: number, code: ApiErrorCode, message: string) =>
  HttpResponse.json<ApiError>({ error: { code, message } }, { status });

/** Telegram id from `Authorization: tma <initData>`; the signature is not checked in mock mode. */
const authenticate = (request: Request, db: MockDb): [number, MockUser] | undefined => {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = `${AUTH_SCHEME} `;
  if (!header.startsWith(prefix)) return undefined;
  const tgId = parseInitDataUserId(header.slice(prefix.length));
  const user = tgId === undefined ? undefined : db.getUser(tgId);
  return tgId === undefined || !user ? undefined : [tgId, user];
};

const unauthorized = () => apiError(401, 'unauthorized', 'Invalid or missing initData');

/** `GET /home` as the server does it: the shared suggestion algorithm over the fixtures. */
export const homeResponse = (
  user: MockUser,
  query: { mode: HomeResponse['mode']; page: number },
  now = new Date(),
): HomeResponse => {
  const userCooks = user.cooks;
  const result = suggestDishes({
    dishes: dishes.map(withIngredients),
    cooks: userCooks,
    user: { ...user.profile, subscribed: user.subscription.active },
    mode: query.mode,
    page: query.page,
    now,
  });
  const suggestions = result.suggestions.flatMap((item): SuggestionCard[] => {
    const dish = dishes.find((candidate) => candidate.id === item.dishId);
    const country = countries.find((candidate) => candidate.id === dish?.countryId);
    if (!dish || !country) return [];
    return [
      {
        dishId: dish.id,
        title: dish.title,
        countryId: country.id,
        countryName: country.nameRu,
        level: dish.level,
        minutes: dish.minutes,
        imageUrl: mockDishImageUrl(dish),
        label: item.label,
        locked: item.locked,
      },
    ];
  });
  return {
    mode: query.mode,
    page: result.page,
    pageCount: result.pageCount,
    suggestions,
    countriesCount: new Set(userCooks.map((cook) => cook.countryId)).size,
    countriesTotal: countries.length,
    dishesCount: userCooks.length,
  };
};

/** Result of `GET /dishes/:id` as the server decides it. */
export type DishResult =
  | { kind: 'ok'; dish: DishResponse }
  | { kind: 'paywall'; preview: DishPreview }
  | { kind: 'notFound' };

/**
 * `GET /dishes/:id` as the server does it: access by `has_access`, the dish with ingredients
 * recalculated for `servings` (default — by «who eats»), the label as on the main screen; a closed
 * dish gets only the preview.
 */
export const dishResult = (
  user: MockUser,
  dishId: string,
  servings: number | undefined,
): DishResult => {
  const dish = dishes.find((candidate) => candidate.id === dishId);
  const country = countries.find((candidate) => candidate.id === dish?.countryId);
  const recipe = recipes[dishId];
  if (!dish || !country || !recipe) return { kind: 'notFound' };
  const userCooks = user.cooks;
  const passed = new Set(userCooks.map((cook) => cook.countryId));
  const imageUrl = mockDishImageUrl(dish);
  if (!hasCountryAccess(country.id, passed, user.subscription.active)) {
    return {
      kind: 'paywall',
      preview: {
        dishId: dish.id,
        title: dish.title,
        countryId: country.id,
        countryName: country.nameRu,
        imageUrl,
      },
    };
  }
  const target = clampServings(servings ?? defaultServings(user.profile.household));
  return {
    kind: 'ok',
    dish: {
      id: dish.id,
      title: dish.title,
      countryId: country.id,
      countryName: country.nameRu,
      level: dish.level,
      minutes: dish.minutes,
      description: dish.description,
      fact: dish.fact,
      imageUrl,
      label: dishLabel(dish, userCooks),
      baseServings: dish.baseServings,
      servings: target,
      ingredients: recipe.ingredients.map((ingredient) => ({
        key: ingredient.key,
        product: ingredient.product,
        name: ingredient.name,
        baseAmount: ingredient.amount,
        amount: scaleAmount(ingredient, dish.baseServings, target),
        unit: ingredient.unit,
        aisle: ingredient.aisle,
      })),
      steps: recipe.steps.map((step, index) => ({ n: index + 1, ...step })),
    },
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const countryCount = (cooks: readonly { countryId: string }[]) =>
  new Set(cooks.map((cook) => cook.countryId)).size;

/** Friends of the user (Telegram ids), from the two-way friendships. */
const friendIdsOf = (tgId: number): number[] =>
  friendships.flatMap(([a, b]) => (a === tgId ? [b] : b === tgId ? [a] : []));

/** Result of `POST /cooks` as the server decides it. */
export type CookResult =
  | { kind: 'ok'; result: CreateCookResponse }
  | { kind: 'notFound' }
  | { kind: 'paywall' }
  | { kind: 'rateLimited' }
  | { kind: 'forbiddenPhoto' };

/**
 * `POST /cooks` as the server does it: access by `has_access`, at most `COOKS_PER_DAY_LIMIT` cooks
 * in 24 hours, a photo only from the user's own folder; then the counters and the friend overtaken.
 */
export const recordCook = (
  db: MockDb,
  tgId: number,
  request: { dishId: string; photoPath?: string | null | undefined },
  now = new Date(),
): CookResult => {
  const user = db.getUser(tgId);
  const dish = dishes.find((candidate) => candidate.id === request.dishId);
  if (!user || !dish) return { kind: 'notFound' };
  const access = dishResult(user, dish.id, undefined);
  if (access.kind === 'notFound') return { kind: 'notFound' };
  if (access.kind === 'paywall') return { kind: 'paywall' };
  const photoPath = request.photoPath ?? null;
  if (photoPath !== null && !photoPath.startsWith(`cooks/${user.profile.id}/`))
    return { kind: 'forbiddenPhoto' };
  const recent = user.cooks.filter(
    (cook) => now.getTime() - new Date(cook.createdAt).getTime() < DAY_MS,
  );
  if (recent.length >= COOKS_PER_DAY_LIMIT) return { kind: 'rateLimited' };

  const before = countryCount(user.cooks);
  const after = countryCount([...user.cooks, dish]);
  const cook = db.addCook(tgId, { dishId: dish.id, countryId: dish.countryId, photoPath }, now);
  if (!cook) return { kind: 'notFound' };
  const friends = friendIdsOf(tgId).flatMap((friendId) => {
    const friend = db.getUser(friendId);
    return friend
      ? [
          {
            name: friend.profile.firstName,
            countries: countryCount(friend.cooks),
            dishes: friend.cooks.length,
          },
        ]
      : [];
  });
  return {
    kind: 'ok',
    result: {
      cookId: cook.id,
      newCountry: after > before,
      countriesCount: after,
      countriesTotal: countries.length,
      dishesCount: user.cooks.length + 1,
      overtook: findOvertakenFriend(before, after, friends),
    },
  };
};

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * MSW request handlers.
 * @param apiBase - absolute API base URL, e.g. `http://localhost:5173/api`.
 * @param controls - forced errors and delays (`?mock_error=`, `?mock_delay=`).
 * @param db - state of the mock backend; a fresh one (fixtures only) by default.
 */
export const createHandlers = (
  apiBase: string,
  controls: MockControls = NO_MOCK_CONTROLS,
  db: MockDb = createMockDb(),
) => [
  http.post<never, never, AuthResponse | ApiError>(`${apiBase}/auth`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'auth'))
      return apiError(500, 'internal', 'Mock error (mock_error=auth)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    const [, user] = auth;
    return HttpResponse.json<AuthResponse>({
      user: user.profile,
      subscription: user.subscription,
      needsOnboarding: !user.onboarded,
    });
  }),

  http.patch<never, never, MeResponse | ApiError>(`${apiBase}/me`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'me')) return apiError(500, 'internal', 'Mock error (mock_error=me)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    const body = updateMeRequestSchema.safeParse(await readJson(request));
    if (!body.success) return apiError(400, 'validation', 'Invalid profile update');
    const user = db.updateUser(auth[0], body.data);
    if (!user) return unauthorized();
    return HttpResponse.json<MeResponse>({ user: user.profile, needsOnboarding: !user.onboarded });
  }),

  http.get<never, never, HomeResponse | ApiError>(`${apiBase}/home`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'home'))
      return apiError(500, 'internal', 'Mock error (mock_error=home)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    const params = new URL(request.url).searchParams;
    const query = homeQuerySchema.safeParse({
      mode: params.get('mode') ?? undefined,
      page: params.get('page') ?? undefined,
    });
    if (!query.success) return apiError(400, 'validation', 'Invalid home query');
    return HttpResponse.json<HomeResponse>(homeResponse(auth[1], query.data));
  }),

  http.get<{ id: string }, never, DishResponse | PaywallError | ApiError>(
    `${apiBase}/dishes/:id`,
    async ({ request, params }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'dish'))
        return apiError(500, 'internal', 'Mock error (mock_error=dish)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const query = dishQuerySchema.parse({
        servings: new URL(request.url).searchParams.get('servings') ?? undefined,
      });
      const result = dishResult(auth[1], params.id, query.servings);
      switch (result.kind) {
        case 'notFound':
          return apiError(404, 'not_found', 'Dish not found');
        case 'paywall':
          return HttpResponse.json<PaywallError>(
            {
              error: {
                code: 'paywall',
                message: 'Subscription required',
                preview: result.preview,
              },
            },
            { status: 403 },
          );
        case 'ok':
          return HttpResponse.json<DishResponse>(result.dish);
      }
    },
  ),

  http.post<never, never, AddShoppingResponse | ApiError>(
    `${apiBase}/shopping`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'shopping'))
        return apiError(500, 'internal', 'Mock error (mock_error=shopping)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const body = addShoppingRequestSchema.safeParse(await readJson(request));
      if (!body.success) return apiError(400, 'validation', 'Invalid shopping items');
      const dish = dishResult(auth[1], body.data.dishId, body.data.servings);
      if (dish.kind === 'notFound') return apiError(404, 'not_found', 'Dish not found');
      if (dish.kind === 'paywall') return apiError(403, 'paywall', 'Subscription required');
      const known = new Set(dish.dish.ingredients.map((ingredient) => ingredient.key));
      if (!body.data.ingredientKeys.every((key) => known.has(key)))
        return apiError(400, 'validation', 'Unknown ingredient');
      const added = db.addShopping(auth[0], body.data);
      if (added === undefined) return unauthorized();
      return HttpResponse.json<AddShoppingResponse>({ added }, { status: 201 });
    },
  ),

  http.post<never, never, UploadCookPhotoResponse | ApiError>(
    `${apiBase}/uploads/cook-photo`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'upload'))
        return apiError(500, 'internal', 'Mock error (mock_error=upload)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      let photo: FormDataEntryValue | null = null;
      try {
        photo = (await request.formData()).get(COOK_PHOTO_FIELD);
      } catch {
        photo = null;
      }
      if (!(photo instanceof Blob) || photo.type !== COOK_PHOTO_TYPE)
        return apiError(400, 'validation', 'A JPEG photo is expected');
      if (photo.size === 0 || photo.size > COOK_PHOTO_MAX_BYTES)
        return apiError(413, 'validation', 'The photo is too large');
      return HttpResponse.json<UploadCookPhotoResponse>(
        { photoPath: `cooks/${auth[1].profile.id}/${crypto.randomUUID()}.jpg` },
        { status: 201 },
      );
    },
  ),

  http.post<never, never, CreateCookResponse | ApiError>(`${apiBase}/cooks`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'cooks'))
      return apiError(500, 'internal', 'Mock error (mock_error=cooks)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    const body = createCookRequestSchema.safeParse(await readJson(request));
    if (!body.success) return apiError(400, 'validation', 'Invalid cook');
    const cook = recordCook(db, auth[0], body.data);
    switch (cook.kind) {
      case 'notFound':
        return apiError(404, 'not_found', 'Dish not found');
      case 'paywall':
        return apiError(403, 'paywall', 'Subscription required');
      case 'rateLimited':
        return apiError(429, 'rate_limited', 'Too many cooks today');
      case 'forbiddenPhoto':
        return apiError(400, 'validation', 'Unknown photo');
      case 'ok':
        return HttpResponse.json<CreateCookResponse>(cook.result, { status: 201 });
    }
  }),
];
