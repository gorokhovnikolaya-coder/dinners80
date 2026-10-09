import { useAuthQuery } from '../api/auth.ts';
import { ErrorState } from '../components/ErrorState.tsx';
import { Skeleton, SkeletonGroup } from '../components/Skeleton.tsx';
import { ru } from '../i18n/ru.ts';

const screen = 'min-h-dvh bg-bg px-5 pt-14 pb-8';

export function App() {
  const { data, isFetching, isError, refetch } = useAuthQuery(undefined);

  // `isFetching` (not only `isLoading`) so a retry after an error shows the loading state too.
  if (isFetching && !data) {
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

  if (isError || !data) {
    return (
      <main className={screen}>
        <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
      </main>
    );
  }

  return (
    <main className={`${screen} flex flex-col gap-3`}>
      <h1 className="font-display text-6xl font-bold">{ru.app.title}</h1>
      <p className="text-xl font-bold">{ru.app.greeting(data.user.firstName)}</p>
      <p className="text-base text-ink-2">{ru.app.placeholder}</p>
    </main>
  );
}
