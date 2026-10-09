import { useAuthQuery } from '../api/auth.ts';
import { ru } from '../i18n/ru.ts';

export function App() {
  const { data, isLoading, isError, refetch } = useAuthQuery(undefined);

  if (isLoading) {
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
        <button type="button" onClick={() => void refetch()}>
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
