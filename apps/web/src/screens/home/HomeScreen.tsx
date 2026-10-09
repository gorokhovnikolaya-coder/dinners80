import type { UserProfile } from '@tma80/shared';

import { ru } from '../../i18n/ru.ts';

/** «Ужин сегодня» — the main screen. A placeholder with the user's name until task 5. */
export function HomeScreen({ user }: { user: UserProfile }) {
  return (
    <main className="flex min-h-dvh flex-col gap-3 bg-bg px-5 pt-14 pb-8">
      <h1 className="font-display text-6xl font-bold">{ru.app.title}</h1>
      <p className="text-xl font-bold">{ru.app.greeting(user.firstName)}</p>
      <p className="text-base text-ink-2">{ru.app.placeholder}</p>
    </main>
  );
}
