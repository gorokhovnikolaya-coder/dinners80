import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from './routes.ts';

/** Index of the current entry in the app's history (React Router keeps it in `history.state`). */
const historyIndex = (): number => {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('idx' in state)) return 0;
  return typeof state.idx === 'number' ? state.idx : 0;
};

/**
 * «Back» of a nested screen: the previous screen of the app, or the main screen if the app was
 * opened right on this one (a link, a reload) — never out of the mini app.
 */
export function useGoBack(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (historyIndex() > 0) void navigate(-1);
    else void navigate(ROUTES.home, { replace: true });
  }, [navigate]);
}
