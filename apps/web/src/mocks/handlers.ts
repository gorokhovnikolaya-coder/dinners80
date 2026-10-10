import {
  AUTH_SCHEME,
  homeQuerySchema,
  suggestDishes,
  updateMeRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type AuthResponse,
  type HomeResponse,
  type MeResponse,
  type SuggestionCard,
} from '@tma80/shared';
import { HttpResponse, delay, http } from 'msw';

import { parseInitDataUserId } from '../telegram/mock/initData.ts';
import { NO_MOCK_CONTROLS, takeFailure, type MockControls } from './controls.ts';
import { createMockDb, type MockDb, type MockUser } from './db.ts';
import { cooks } from './fixtures/cooks.ts';
import { countries } from './fixtures/countries.ts';
import { dishes, withIngredients } from './fixtures/dishes.ts';
import { mockDishImageUrl } from './fixtures/images.ts';

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
  const userCooks = cooks.filter((cook) => cook.userId === user.profile.id);
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
];
