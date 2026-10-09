import {
  AUTH_SCHEME,
  updateMeRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type AuthResponse,
  type MeResponse,
} from '@tma80/shared';
import { HttpResponse, delay, http } from 'msw';

import { parseInitDataUserId } from '../telegram/mock/initData.ts';
import { NO_MOCK_CONTROLS, takeFailure, type MockControls } from './controls.ts';
import { createMockDb, type MockDb, type MockUser } from './db.ts';

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
];
