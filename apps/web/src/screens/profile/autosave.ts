import type { UpdateMeRequest } from '@tma80/shared';

/** Fields of the profile being saved (`PATCH /me`). */
export type ProfilePatch = UpdateMeRequest;

const definedEntries = (patch: ProfilePatch) =>
  Object.entries(patch).filter(([, value]) => value !== undefined);

/** Both patches in one; fields of `later` win. `null` stands for «nothing». */
export function mergePatches(
  earlier: ProfilePatch | null,
  later: ProfilePatch | null,
): ProfilePatch | null {
  if (!earlier) return later;
  if (!later) return earlier;
  return { ...earlier, ...(Object.fromEntries(definedEntries(later)) as ProfilePatch) };
}

/** `patch` without the fields that `newer` sets; `null` if nothing is left. */
export function withoutFields(
  patch: ProfilePatch | null,
  newer: ProfilePatch | null,
): ProfilePatch | null {
  if (!patch) return null;
  const left = definedEntries(patch).filter(
    ([key]) => newer?.[key as keyof ProfilePatch] === undefined,
  );
  return left.length > 0 ? Object.fromEntries(left) : null;
}

/** What the screen shows of the autosave. */
export interface AutosaveSnapshot {
  /** Changes not confirmed by the server yet (sent or waiting): shown over the server profile. */
  pending: ProfilePatch | null;
  /** Changes the server did not save: rolled back on screen, sent again by `retry`. */
  failed: ProfilePatch | null;
}

/**
 * Autosave of the profile: every change is sent at once (`PATCH /me`), one request at a time —
 * changes made while a request is in flight wait and go together in the next one, so responses
 * never come back out of order. A failed request is rolled back (it leaves `pending`) and kept in
 * `failed` until `retry`; a newer change of the same field replaces it there.
 * `subscribe` / `getSnapshot` fit `useSyncExternalStore`.
 * @param send - sends a patch; rejects if the server did not save it.
 */
export function createAutosave(send: (patch: ProfilePatch) => Promise<unknown>) {
  let inFlight: ProfilePatch | null = null;
  let queued: ProfilePatch | null = null;
  let snapshot: AutosaveSnapshot = { pending: null, failed: null };
  const listeners = new Set<() => void>();

  const update = (failed: ProfilePatch | null) => {
    snapshot = { pending: mergePatches(inFlight, queued), failed };
    for (const listener of listeners) listener();
  };

  const flush = () => {
    if (inFlight || !queued) return;
    const patch = queued;
    inFlight = patch;
    queued = null;
    update(snapshot.failed);
    void send(patch)
      .then(
        () => snapshot.failed,
        // A change made since then wins over the failed one.
        () => mergePatches(snapshot.failed, withoutFields(patch, queued)),
      )
      .then((failed) => {
        inFlight = null;
        update(failed);
        flush();
      });
  };

  return {
    /** Saves the change: shown at once, sent now or right after the request in flight. */
    save: (patch: ProfilePatch) => {
      queued = mergePatches(queued, patch);
      update(withoutFields(snapshot.failed, patch));
      flush();
    },
    /** Sends the failed changes again (newer waiting changes still win). */
    retry: () => {
      const { failed } = snapshot;
      if (!failed) return;
      queued = mergePatches(failed, queued);
      update(null);
      flush();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): AutosaveSnapshot => snapshot,
  };
}

export type Autosave = ReturnType<typeof createAutosave>;
