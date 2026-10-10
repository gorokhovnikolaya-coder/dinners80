import { lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react';

import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary.tsx';

interface ScreenModule {
  default: ComponentType;
}

export interface LazyScreenOptions {
  /** Reloads the page when the retried import fails again. Replaced in unit tests. */
  reloadPage?: () => void;
}

/** A promise that never settles: the page is reloading, keep showing the fallback. */
const never = () => new Promise<never>(() => undefined);

/**
 * A lazily loaded screen (ТЗ: every screen except the main one) with a loading fallback and an
 * error boundary. If the chunk fails to load, «Повторить» imports it again with a new `lazy`
 * (`React.lazy` remembers a failed import). Some engines (Chrome 144, older Telegram WebViews)
 * also cache a failed dynamic `import()` of the same URL and reject again without a request, so
 * if the retry fails too, the page is reloaded: a new document starts with an empty module map.
 * The reload happens only on the user's «Повторить», so a dead network cannot loop it.
 */
export function lazyScreen(
  load: () => Promise<ScreenModule>,
  fallback: ReactNode = null,
  {
    reloadPage = () => {
      window.location.reload();
    },
  }: LazyScreenOptions = {},
): ComponentType {
  const initial = lazy(load);
  const retry = () =>
    load().catch((error: unknown) => {
      console.error('Screen chunk failed again, reloading the page', error);
      reloadPage();
      return never();
    });

  function LazyScreen() {
    const [Screen, setScreen] = useState(() => initial);
    return (
      <ScreenErrorBoundary
        onRetry={() => {
          setScreen(() => lazy(retry));
        }}
      >
        <Suspense fallback={fallback}>
          <Screen />
        </Suspense>
      </ScreenErrorBoundary>
    );
  }
  return LazyScreen;
}
