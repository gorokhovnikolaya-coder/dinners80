import { AUTH_SCHEME, type ApiError, type ApiErrorCode, type AuthResponse } from '@tma80/shared';
import { HttpResponse, delay, http } from 'msw';

import { parseInitDataUserId } from '../telegram/mock/initData.ts';
import { NO_MOCK_CONTROLS, takeFailure, type MockControls } from './controls.ts';
import { findUserByTgId, type UserFixture } from './fixtures/users.ts';

const apiError = (status: number, code: ApiErrorCode, message: string) =>
  HttpResponse.json<ApiError>({ error: { code, message } }, { status });

/** The user from `Authorization: tma <initData>`; the signature is not checked in mock mode. */
const authenticate = (request: Request): UserFixture | undefined => {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = `${AUTH_SCHEME} `;
  if (!header.startsWith(prefix)) return undefined;
  const tgId = parseInitDataUserId(header.slice(prefix.length));
  return tgId === undefined ? undefined : findUserByTgId(tgId);
};

/**
 * MSW request handlers.
 * @param apiBase - absolute API base URL, e.g. `http://localhost:5173/api`.
 * @param controls - forced errors and delays (`?mock_error=`, `?mock_delay=`).
 */
export const createHandlers = (apiBase: string, controls: MockControls = NO_MOCK_CONTROLS) => [
  http.post<never, never, AuthResponse | ApiError>(`${apiBase}/auth`, async ({ request }) => {
    if (controls.delayMs > 0) await delay(controls.delayMs);
    if (takeFailure(controls, 'auth'))
      return apiError(500, 'internal', 'Mock error (mock_error=auth)');
    const user = authenticate(request);
    if (!user) return apiError(401, 'unauthorized', 'Invalid or missing initData');
    return HttpResponse.json<AuthResponse>({
      user: user.profile,
      subscription: user.subscription,
      needsOnboarding: !user.onboarded,
    });
  }),
];
