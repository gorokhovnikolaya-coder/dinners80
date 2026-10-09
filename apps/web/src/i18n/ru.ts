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
    errorHint: 'Проверьте интернет и попробуйте ещё раз.',
    retry: 'Повторить',
  },
  tabs: {
    label: 'Разделы',
    dinner: 'Ужин',
    map: 'Карта',
    friends: 'Друзья',
  },
} as const;

/**
 * Strings of the dev-only component gallery `/dev/ui`. A separate export, so a production build,
 * which never imports the gallery, tree-shakes them away.
 */
export const ruDevUi = {
  title: 'Компоненты',
  subtitle: 'Дизайн-токены и базовые компоненты (только dev-режим)',
  sections: {
    colors: 'Цвета',
    typography: 'Шрифты',
    button: 'Button',
    card: 'Card',
    chip: 'Chip',
    tabBar: 'TabBar',
    progressBar: 'ProgressBar',
    checkbox: 'Checkbox',
    skeleton: 'Skeleton',
    errorState: 'ErrorState',
  },
  typography: {
    display: 'Что на ужин сегодня?',
    body: 'Говядина, жаренная как в воке, с картошкой фри и рисом.',
    caption: 'Четверг, 8 октября',
  },
  buttons: {
    primary: 'Позвать друга',
    accent: 'Начать готовить',
    secondary: 'Показать другие',
    ghost: 'Не сейчас',
    inverse: 'Продолжить путешествие',
    disabled: 'Недоступно',
    medium: 'Средняя кнопка',
    back: 'Назад',
    cart: 'В список покупок',
    close: 'Закрыть',
  },
  card: {
    country: 'Перу',
    dish: 'Ломо сальтадо',
    time: '30 мин',
    weekday: 'Будний вечер',
    portions: '2 порции',
    newCountry: 'Новая страна',
    passportTitle: 'стран пройдено',
    passportCount: '8',
    passportTotal: '/30',
  },
  chips: {
    noMeat: 'Без мяса',
    noPork: 'Без свинины',
    noFish: 'Без рыбы',
    disabled: 'Без глютена',
  },
  progress: {
    countries: 'Пройдено стран',
    countriesValue: (value: number, max: number) => `${String(value)} из ${String(max)} стран`,
    steps: 'Шаги рецепта',
    stepsValue: (value: number, max: number) => `Шаг ${String(value)} из ${String(max)}`,
    onboarding: 'Вопросы онбординга',
  },
  checkbox: {
    beef: 'Говядина (вырезка)',
    beefQty: '400 г',
    potato: 'Картофель',
    potatoQty: '3 шт',
    rice: 'Рис круглый',
    riceDish: 'Оякодон',
    riceQty: '150 г',
    tomato: 'Помидоры',
    tomatoDish: 'Ломо сальтадо',
    tomatoQty: '2 шт',
    disabled: 'Соевый соус',
  },
  skeleton: {
    dishCard: 'Загрузка карточки блюда',
  },
  errorState: {
    retried: (count: number) => `Нажато «Повторить»: ${String(count)}`,
  },
} as const;
