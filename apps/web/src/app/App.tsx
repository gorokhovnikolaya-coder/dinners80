import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { useAuthQuery } from '../api/auth.ts';
import { ErrorState } from '../components/ErrorState.tsx';
import { Skeleton, SkeletonGroup } from '../components/Skeleton.tsx';
import { ru } from '../i18n/ru.ts';
import { HomeScreen } from '../screens/home/HomeScreen.tsx';
import { ROUTES } from './routes.ts';

/** Screens other than the main one load lazily (ТЗ, НФТ «Производительность»). */
const OnboardingScreen = lazy(() => import('../screens/onboarding/OnboardingScreen.tsx'));

/**
 * The dev-only component gallery. `import.meta.env.DEV` is false in `vite build`, so the route and
 * its chunk are dropped from production.
 */
const DevUiPage = import.meta.env.DEV
  ? lazy(() => import('../dev/DevUiPage.tsx').then(({ DevUiPage }) => ({ default: DevUiPage })))
  : undefined;

const screen = 'min-h-dvh bg-bg px-5 pt-14 pb-8';

/** Light skeleton of a screen while `POST /auth` is in flight. */
function ScreenSkeleton() {
  return (
    <main className={screen}>
      <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-4">
        <Skeleton shape="text" width="60%" className="text-6xl" />
        <Skeleton shape="text" width="40%" className="text-lg" />
        <Skeleton height={150} className="mt-2" />
      </SkeletonGroup>
    </main>
  );
}

/** Navy placeholder while the onboarding chunk loads, so the screen does not flash light. */
function DarkScreenFallback() {
  return (
    <main className="min-h-dvh bg-ink" aria-busy="true">
      <span className="sr-only" role="status">
        {ru.common.loading}
      </span>
    </main>
  );
}

/**
 * Signs the user in (`POST /auth`) and routes by `needsOnboarding`: the onboarding is shown once,
 * until the answers are saved; then the main screen. After `PATCH /me` the cached auth result is
 * updated, and the routes below switch to the main screen without a refetch.
 */
function AuthenticatedApp() {
  const { data, isFetching, isError, refetch } = useAuthQuery(undefined);

  // `isFetching` (not only `isLoading`) so a retry after an error shows the loading state too.
  if (isFetching && !data) return <ScreenSkeleton />;

  if (isError || !data) {
    return (
      <main className={screen}>
        <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
      </main>
    );
  }

  const { needsOnboarding, user } = data;
  return (
    <Routes>
      <Route
        path={ROUTES.onboarding}
        element={
          needsOnboarding ? (
            <Suspense fallback={<DarkScreenFallback />}>
              <OnboardingScreen />
            </Suspense>
          ) : (
            <Navigate to={ROUTES.home} replace />
          )
        }
      />
      <Route
        path={ROUTES.home}
        element={
          needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <HomeScreen user={user} />
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <Routes>
      {DevUiPage && (
        <Route
          path={ROUTES.devUi}
          element={
            <Suspense>
              <DevUiPage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  );
}
