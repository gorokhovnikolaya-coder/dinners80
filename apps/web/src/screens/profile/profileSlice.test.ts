import type { MeResponse } from '@tma80/shared';
import { describe, expect, it } from 'vitest';

import { meApi } from '../../api/me.ts';
import { profileSlice, writeAccessAllowed } from './profileSlice.ts';
import { reminderView } from './profile.ts';

const reducer = profileSlice.reducer;

/** The fulfilled action of `PATCH /me` with the server's `botCanWrite`. */
const meFulfilled = (botCanWrite: boolean) =>
  ({
    type: 'api/executeMutation/fulfilled',
    payload: { user: { botCanWrite }, needsOnboarding: false } as unknown as MeResponse,
    meta: {
      arg: { type: 'mutation', endpointName: 'updateMe', originalArgs: {} },
      requestId: 'r1',
      requestStatus: 'fulfilled',
      fulfilledTimeStamp: 0,
      baseQueryMeta: undefined,
      RTK_autoBatch: true,
    },
  }) as const;

describe('profileSlice', () => {
  it('keeps the session permission until the server confirms botCanWrite', () => {
    expect(meApi.endpoints.updateMe.matchFulfilled(meFulfilled(true))).toBe(true);
    let state = reducer(undefined, writeAccessAllowed());
    expect(state.writeAccessAllowed).toBe(true);
    // The webhook has not come yet: the server still says false.
    state = reducer(state, meFulfilled(false));
    expect(state.writeAccessAllowed).toBe(true);
    // Confirmed: the server is the source of truth again.
    state = reducer(state, meFulfilled(true));
    expect(state.writeAccessAllowed).toBe(false);
  });

  it('shows the reminder off once the bot is blocked after a confirmed permission', () => {
    let state = reducer(undefined, writeAccessAllowed());
    state = reducer(state, meFulfilled(true));
    // Later in the session the user blocks the bot; the server reports false.
    state = reducer(state, meFulfilled(false));
    expect(
      reminderView({ reminderEnabled: true, botCanWrite: false }, state.writeAccessAllowed, true)
        .checked,
    ).toBe(false);
  });
});
