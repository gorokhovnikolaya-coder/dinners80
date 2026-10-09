import { useAuthQuery } from '../api/auth.ts';
import { ru } from '../i18n/ru.ts';

/** Minimal touch target until the design components of task 3. */
const TOUCH_TARGET = { minWidth: 44, minHeight: 44 } as const;

export function App() {
  const { data, isFetching, isError, refetch } = useAuthQuery(undefined);

  // `isFetching` (not only `isLoading`) so a retry after an error shows the loading state too.
  if (isFetching && !data) {
    return (
      <main aria-busy="true">
        <p>{ru.common.loading}</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main>
        <p role="alert">{ru.common.error}</p>
        <button type="button" style={TOUCH_TARGET} onClick={() => void refetch()}>
          {ru.common.retry}
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>{ru.app.title}</h1>
      <p>{ru.app.greeting(data.user.firstName)}</p>
      <p>{ru.app.placeholder}</p>
    </main>
  );
}
