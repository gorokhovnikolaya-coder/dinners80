import {
  AUTH_SCHEME,
  COOK_PHOTO_FIELD,
  COOK_PHOTO_MAX_BYTES,
  COOK_PHOTO_TYPE,
  SHARE_CARD_FIELD,
  SHARE_CARD_MAX_BYTES,
  SHARE_CARD_TYPE,
  COOKS_PER_DAY_LIMIT,
  addShoppingRequestSchema,
  eventsRequestSchema,
  buildLeaderboard,
  updateShoppingItemRequestSchema,
  buildPassport,
  createCookRequestSchema,
  createInvoiceRequestSchema,
  findOvertakenFriend,
  clampServings,
  defaultServings,
  dishLabel,
  dishQuerySchema,
  hasCountryAccess,
  homeQuerySchema,
  latestFriendStamps,
  leaderboardQuerySchema,
  scaleAmount,
  suggestDishes,
  updateMeRequestSchema,
  uploadShareCardQuerySchema,
  type AddShoppingResponse,
  type EventsResponse,
  type ApiError,
  type ClearShoppingResponse,
  type ShoppingItem,
  type ShoppingResponse,
  type ApiErrorCode,
  type AuthResponse,
  type CreateCookResponse,
  type CreateInvoiceResponse,
  type UploadCookPhotoResponse,
  type UploadShareCardResponse,
  type ShareStampResponse,
  type DishPreview,
  type DishResponse,
  type FeedResponse,
  type HomeResponse,
  type LeaderboardParticipant,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type MapResponse,
  type PaywallError,
  type MeResponse,
  type SuggestionCard,
} from '@tma80/shared';
import { HttpResponse, delay, http } from 'msw';

import { parseInitDataStartParam, parseInitDataUserId } from '../telegram/mock/initData.ts';
import { NO_MOCK_CONTROLS, takeFailure, type MockControls } from './controls.ts';
import { createMockDb, type MockDb, type MockShoppingItem, type MockUser } from './db.ts';
import { countries } from './fixtures/countries.ts';
import { dishes, withIngredients } from './fixtures/dishes.ts';
import { mockCookPhotoUrl, mockDishImageUrl } from './fixtures/images.ts';
import { recipes } from './fixtures/recipes.ts';
import { friendships } from './fixtures/users.ts';

const apiError = (status: number, code: ApiErrorCode, message: string) =>
  HttpResponse.json<ApiError>({ error: { code, message } }, { status });

/** Raw initData of `Authorization: tma <initData>`, or `undefined` without it. */
const authorizationInitData = (request: Request): string | undefined => {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = `${AUTH_SCHEME} `;
  return header.startsWith(prefix) ? header.slice(prefix.length) : undefined;
};

/** Telegram id from `Authorization: tma <initData>`; the signature is not checked in mock mode. */
const authenticate = (request: Request, db: MockDb): [number, MockUser] | undefined => {
  const initData = authorizationInitData(request);
  if (initData === undefined) return undefined;
  const tgId = parseInitDataUserId(initData);
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

/** `GET /map` as the server does it: the shared `buildPassport` over the fixtures. */
export const mapResponse = (user: MockUser): MapResponse =>
  buildPassport({
    countries: countries.map((country) => ({ ...country, name: country.nameRu })),
    dishes: dishes.map((dish) => ({ ...dish, imageUrl: mockDishImageUrl(dish) })),
    cooks: user.cooks,
    subscribed: user.subscription.active,
  });

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

/** Friends of the user (Telegram ids): the fixture friendships plus invitations of the session. */
const friendIdsOf = (db: MockDb, tgId: number): number[] => {
  const fixed = friendships.flatMap(([a, b]) => (a === tgId ? [b] : b === tgId ? [a] : []));
  return [...fixed, ...db.invitedFriends(tgId).filter((id) => !fixed.includes(id))];
};

const participantOf = (user: MockUser): LeaderboardParticipant => ({
  userId: user.profile.id,
  firstName: user.profile.firstName,
  photoUrl: user.profile.photoUrl,
  cooks: user.cooks,
});

const friendsOf = (db: MockDb, tgId: number): MockUser[] =>
  friendIdsOf(db, tgId).flatMap((friendId) => {
    const friend = db.getUser(friendId);
    return friend ? [friend] : [];
  });

/** `GET /friends/leaderboard` as the server does it: the shared `buildLeaderboard`. */
export const leaderboardResponse = (
  db: MockDb,
  tgId: number,
  period: LeaderboardPeriod,
  now = new Date(),
): LeaderboardResponse | undefined => {
  const user = db.getUser(tgId);
  if (!user) return undefined;
  return buildLeaderboard({
    me: participantOf(user),
    friends: friendsOf(db, tgId).map(participantOf),
    period,
    now,
    timezone: user.profile.timezone,
  });
};

/**
 * `GET /friends/feed` as the server does it: the latest first stamps of friends with the dish,
 * the country and a link to the photo (the server signs it for an hour; the mock draws one).
 */
export const feedResponse = (db: MockDb, tgId: number): FeedResponse => ({
  items: latestFriendStamps(
    friendsOf(db, tgId).map((friend) =>
      friend.cooks.map((cook) => ({ ...cook, firstName: friend.profile.firstName })),
    ),
  ).flatMap((cook) => {
    const dish = dishes.find((candidate) => candidate.id === cook.dishId);
    const country = countries.find((candidate) => candidate.id === cook.countryId);
    if (!dish || !country) return [];
    return [
      {
        cookId: cook.id,
        userId: cook.userId,
        firstName: cook.firstName,
        countryId: country.id,
        countryName: country.nameRu,
        dishId: dish.id,
        dishTitle: dish.title,
        photoUrl: cook.photoPath === null ? null : mockCookPhotoUrl(cook.photoPath),
        createdAt: cook.createdAt,
      },
    ];
  }),
});

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
  // Like the server: `cook_finished` is written with the cook (decision 0024).
  db.recordEvents(tgId, [
    {
      name: 'cook_finished',
      props: { dish_id: dish.id, new_country: after > before, has_photo: photoPath !== null },
    },
  ]);
  const friends = friendsOf(db, tgId).map((friend) => ({
    name: friend.profile.firstName,
    countries: countryCount(friend.cooks),
    dishes: friend.cooks.length,
  }));
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

/**
 * An item of `GET /shopping` as the server builds it: the ingredient and the dish of the stored
 * item, the amount recalculated for its servings. Items of unknown dishes or ingredients are
 * dropped.
 */
export const shoppingItemOf = (item: MockShoppingItem): ShoppingItem | undefined => {
  const dish = dishes.find((candidate) => candidate.id === item.dishId);
  const ingredient = recipes[item.dishId]?.ingredients.find(
    (candidate) => candidate.key === item.ingredientKey,
  );
  if (!dish || !ingredient) return undefined;
  return {
    id: item.id,
    dishId: dish.id,
    dishTitle: dish.title,
    product: ingredient.product,
    name: ingredient.name,
    amount: scaleAmount(ingredient, dish.baseServings, item.servings),
    unit: ingredient.unit,
    aisle: ingredient.aisle,
    checked: item.checked,
    createdAt: item.createdAt,
  };
};

/** `GET /shopping`: the user's items, oldest first. */
export const shoppingResponse = (db: MockDb, tgId: number): ShoppingResponse => ({
  items: [...db.getShopping(tgId)]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    .flatMap((item) => {
      const built = shoppingItemOf(item);
      return built ? [built] : [];
    }),
});

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
    const [tgId] = auth;
    // `?startapp=<code>` of the mock client: the invitation, as `POST /auth` handles it.
    const startParam = parseInitDataStartParam(authorizationInitData(request) ?? '');
    if (startParam !== undefined) db.acceptInvite(tgId, startParam);
    const user = db.getUser(tgId);
    if (!user) return unauthorized();
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

  http.get<never, never, MapResponse | ApiError>(`${apiBase}/map`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'map'))
      return apiError(500, 'internal', 'Mock error (mock_error=map)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    return HttpResponse.json<MapResponse>(mapResponse(auth[1]));
  }),

  http.get<never, never, LeaderboardResponse | ApiError>(
    `${apiBase}/friends/leaderboard`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'friends'))
        return apiError(500, 'internal', 'Mock error (mock_error=friends)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const query = leaderboardQuerySchema.safeParse({
        period: new URL(request.url).searchParams.get('period') ?? undefined,
      });
      if (!query.success) return apiError(400, 'validation', 'Invalid leaderboard period');
      const result = leaderboardResponse(db, auth[0], query.data.period);
      if (!result) return unauthorized();
      return HttpResponse.json<LeaderboardResponse>(result);
    },
  ),

  http.get<never, never, FeedResponse | ApiError>(
    `${apiBase}/friends/feed`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'friends_feed'))
        return apiError(500, 'internal', 'Mock error (mock_error=friends_feed)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      return HttpResponse.json<FeedResponse>(feedResponse(db, auth[0]));
    },
  ),

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

  http.get<never, never, ShoppingResponse | ApiError>(
    `${apiBase}/shopping`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'shopping_list'))
        return apiError(500, 'internal', 'Mock error (mock_error=shopping_list)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      return HttpResponse.json<ShoppingResponse>(shoppingResponse(db, auth[0]));
    },
  ),

  http.delete<never, never, ClearShoppingResponse | ApiError>(
    `${apiBase}/shopping/checked`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'shopping_clear'))
        return apiError(500, 'internal', 'Mock error (mock_error=shopping_clear)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const removed = db.clearCheckedShopping(auth[0]);
      if (removed === undefined) return unauthorized();
      return HttpResponse.json<ClearShoppingResponse>({ removed });
    },
  ),

  http.patch<{ id: string }, never, ShoppingItem | ApiError>(
    `${apiBase}/shopping/:id`,
    async ({ request, params }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'shopping_check'))
        return apiError(500, 'internal', 'Mock error (mock_error=shopping_check)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const body = updateShoppingItemRequestSchema.safeParse(await readJson(request));
      if (!body.success) return apiError(400, 'validation', 'Invalid shopping item');
      const changed = db.setShoppingChecked(auth[0], params.id, body.data.checked);
      const item = changed && shoppingItemOf(changed);
      if (!item) return apiError(404, 'not_found', 'Shopping item not found');
      return HttpResponse.json<ShoppingItem>(item);
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

  http.post<never, never, EventsResponse | ApiError>(`${apiBase}/events`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'events'))
      return apiError(500, 'internal', 'Mock error (mock_error=events)');
    const auth = authenticate(request, db);
    if (!auth) return unauthorized();
    const body = eventsRequestSchema.safeParse(await readJson(request));
    if (!body.success) return apiError(400, 'validation', 'Invalid events');
    db.recordEvents(auth[0], body.data.events);
    return HttpResponse.json<EventsResponse>({ stored: body.data.events.length });
  }),

  http.post<never, never, CreateInvoiceResponse | ApiError>(
    `${apiBase}/payments/invoice`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'invoice'))
        return apiError(500, 'internal', 'Mock error (mock_error=invoice)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const body = createInvoiceRequestSchema.safeParse(await readJson(request));
      if (!body.success) return apiError(400, 'validation', 'Invalid plan');
      // Like the server: no second monthly Stars subscription while one is active (decision 0021).
      const { subscription } = auth[1];
      if (
        body.data.plan === 'month' &&
        subscription.active &&
        subscription.plan === 'month' &&
        subscription.expiresAt !== null &&
        Date.parse(subscription.expiresAt) > Date.now()
      )
        return apiError(409, 'conflict', 'The monthly subscription is already active');
      // The server creates the link with `createInvoiceLink` (price from the shared constants);
      // the mock Telegram client «pays» it by the slug (`?mock_invoice=`).
      const slug = db.createInvoice(auth[0], body.data.plan);
      if (slug === undefined) return unauthorized();
      return HttpResponse.json<CreateInvoiceResponse>(
        { invoiceLink: `https://t.me/$${slug}` },
        { status: 201 },
      );
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

  // The share card of a cook: the server puts it into the public `share` folder, one per cook.
  http.post<never, never, UploadShareCardResponse | ApiError>(
    `${apiBase}/uploads/share-card`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'share_card'))
        return apiError(500, 'internal', 'Mock error (mock_error=share_card)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const query = uploadShareCardQuerySchema.safeParse({
        cookId: new URL(request.url).searchParams.get('cookId') ?? undefined,
      });
      if (!query.success) return apiError(400, 'validation', 'Invalid cook');
      if (db.shareCardOf(auth[0], query.data.cookId) === undefined)
        return apiError(404, 'not_found', 'Cook not found');
      let card: FormDataEntryValue | null = null;
      try {
        card = (await request.formData()).get(SHARE_CARD_FIELD);
      } catch {
        card = null;
      }
      if (!(card instanceof Blob) || card.type !== SHARE_CARD_TYPE)
        return apiError(400, 'validation', 'A JPEG card is expected');
      if (card.size === 0 || card.size > SHARE_CARD_MAX_BYTES)
        return apiError(413, 'validation', 'The card is too large');
      const attached = db.attachShareCard(
        auth[0],
        query.data.cookId,
        `/media/share/${crypto.randomUUID()}.jpg`,
        card,
      );
      if (!attached) return apiError(404, 'not_found', 'Cook not found');
      return HttpResponse.json<UploadShareCardResponse>(
        { url: attached.url },
        { status: attached.created ? 201 : 200 },
      );
    },
  ),

  // The public `share` folder (nginx in production): the cards uploaded in this page.
  http.get<{ name: string }>('*/media/share/:name', ({ params }) => {
    const card = db.shareCardFile(`/media/share/${params.name}`);
    return card
      ? new HttpResponse(card, { headers: { 'Content-Type': SHARE_CARD_TYPE } })
      : new HttpResponse(null, { status: 404 });
  }),

  // The prepared share message (`savePreparedInlineMessage`) with the card of the cook.
  http.post<{ cookId: string }, never, ShareStampResponse | ApiError>(
    `${apiBase}/share/stamp/:cookId`,
    async ({ request, params }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'share_stamp'))
        return apiError(500, 'internal', 'Mock error (mock_error=share_stamp)');
      const auth = authenticate(request, db);
      if (!auth) return unauthorized();
      const card = db.shareCardOf(auth[0], params.cookId);
      if (card === undefined) return apiError(404, 'not_found', 'Cook not found');
      if (card === null) return apiError(400, 'validation', 'Upload the share card first');
      if (takeFailure(controls, 'share_unavailable'))
        return apiError(503, 'unavailable', 'Mock error (mock_error=share_unavailable)');
      return HttpResponse.json<ShareStampResponse>({
        preparedMessageId: `mock-prepared-${params.cookId}`,
      });
    },
  ),

  http.post<never, never, CreateCookResponse | ApiError>(
    `${apiBase}/cooks`,
    async ({ request }) => {
      if (controls.delayMs > 0) await delay(controls.delayMs);
      if (takeFailure(controls, 'cooks'))
        return apiError(500, 'internal', 'Mock error (mock_error=cooks)');
      if (takeFailure(controls, 'cooks_limit'))
        return apiError(429, 'rate_limited', 'Too many cooks today (mock_error=cooks_limit)');
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
    },
  ),
];
