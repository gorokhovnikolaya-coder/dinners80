/** All user-facing strings of the mini app. */
export const ru = {
  app: {
    title: 'Вокруг света за 80 ужинов',
    greeting: (name: string) => `Привет, ${name}!`,
    placeholder: 'Скоро здесь будет ужин на сегодня.',
  },
  common: {
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные.',
    retry: 'Повторить',
  },
} as const;
