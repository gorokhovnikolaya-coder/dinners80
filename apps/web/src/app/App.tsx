import { Navigate, Route, Routes } from 'react-router';

import { useAuthQuery } from '../api/auth.ts';
import { ErrorState } from '../components/ErrorState.tsx';
import { Skeleton, SkeletonGroup } from '../components/Skeleton.tsx';
import { ru } from '../i18n/ru.ts';
import { HomeScreen } from '../screens/home/HomeScreen.tsx';
import { lazyScreen } from './lazyScreen.tsx';
import { ROUTES } from './routes.ts';

const screen = 'min-h-dvh bg-bg px-5 pt-14 pb-8';

/**
 * Light skeleton of a screen while `POST /auth` is in flight; also shown while a lazy screen's
 * chunk loads, so the background stays the same from start to the screen.
 */
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

/**
 * Screens other than the main one load lazily (ТЗ, НФТ «Производительность»), each behind an error
 * boundary: a chunk that fails to load shows «Повторить» instead of a blank page.
 */
const OnboardingScreen = lazyScreen(
  () => import('../screens/onboarding/OnboardingScreen.tsx'),
  <ScreenSkeleton />,
);

const DishScreen = lazyScreen(() => import('../screens/dish/DishScreen.tsx'), <ScreenSkeleton />);

const CookingScreen = lazyScreen(
  () => import('../screens/cooking/CookingScreen.tsx'),
  <ScreenSkeleton />,
);

const CookedScreen = lazyScreen(
  () => import('../screens/cooked/CookedScreen.tsx'),
  <ScreenSkeleton />,
);

const MapScreen = lazyScreen(() => import('../screens/map/MapScreen.tsx'), <ScreenSkeleton />);

const CountryScreen = lazyScreen(
  () => import('../screens/map/CountryScreen.tsx'),
  <ScreenSkeleton />,
);

const FriendsScreen = lazyScreen(
  () => import('../screens/friends/FriendsScreen.tsx'),
  <ScreenSkeleton />,
);

/** Temporary paywall (task 6) until the real one (task 12). */
const PaywallScreen = lazyScreen(
  () => import('../screens/paywall/PaywallStubScreen.tsx'),
  <ScreenSkeleton />,
);

/**
 * The dev-only component gallery. `import.meta.env.DEV` is false in `vite build`, so the route and
 * its chunk are dropped from production.
 */
const DevUiPage = import.meta.env.DEV
  ? lazyScreen(() =>
      import('../dev/DevUiPage.tsx').then(({ DevUiPage }) => ({ default: DevUiPage })),
    )
  : undefined;

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
        element={needsOnboarding ? <OnboardingScreen /> : <Navigate to={ROUTES.home} replace />}
      />
      <Route
        path={ROUTES.home}
        element={
          needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <HomeScreen user={user} />
        }
      />
      <Route
        path={ROUTES.dish}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <DishScreen />}
      />
      <Route
        path={ROUTES.cooking}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <CookingScreen />}
      />
      <Route
        path={ROUTES.cooked}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <CookedScreen />}
      />
      <Route
        path={ROUTES.map}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <MapScreen />}
      />
      <Route
        path={ROUTES.country}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <CountryScreen />}
      />
      <Route
        path={ROUTES.friends}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <FriendsScreen />}
      />
      <Route
        path={ROUTES.paywall}
        element={needsOnboarding ? <Navigate to={ROUTES.onboarding} replace /> : <PaywallScreen />}
      />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <Routes>
      {DevUiPage && <Route path={ROUTES.devUi} element={<DevUiPage />} />}
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  );
}
