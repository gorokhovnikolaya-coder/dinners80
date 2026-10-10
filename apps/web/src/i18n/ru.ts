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
    back: 'Назад',
    screenLoadError: 'Не удалось открыть экран.',
  },
  preferences: {
    household: {
      solo: { title: 'Я один', description: '1 порция' },
      couple: { title: 'Мы вдвоём', description: '2 порции' },
      family: { title: 'Семья с детьми', description: '3–4 порции' },
    },
    weekdayMinutes: (minutes: number) => `${String(minutes)} минут`,
    exclusions: {
      meat: { title: 'Мясо', description: 'Включая свинину' },
      spicy: { title: 'Острое' },
      gluten: { title: 'Глютен', description: 'Мука, паста, хлеб, соевый соус' },
    },
    /** The user's own exclusions: free text matched against dish titles and ingredients. */
    customExclusions: {
      label: 'Своё',
      hint: 'Например, кинза или грибы: уберём блюда, где это есть в названии или в ингредиентах.',
      placeholder: 'Продукт или блюдо',
      add: 'Добавить',
      list: 'Ваши исключения',
      remove: (word: string) => `Удалить «${word}»`,
      errors: {
        tooShort: (min: number) => `Слишком коротко: нужно хотя бы ${String(min)} символа.`,
        tooLong: (max: number) => `Слишком длинно: не больше ${String(max)} символов.`,
        noLetter: 'Нужна хотя бы одна буква.',
        duplicate: 'Это уже есть в списке.',
        limit: (max: number) => `Можно добавить не больше ${String(max)}.`,
      },
    },
  },
  onboarding: {
    progress: 'Вопросы онбординга',
    counter: (step: number, total: number) => `Вопрос ${String(step)} из ${String(total)}`,
    steps: {
      household: {
        title: 'Кто ест за вашим столом?',
        description: 'Подстроим порции и подскажем блюда, которые понравятся всем.',
        hint: 'Дальше: время на ужин в будни и что вы не едите',
      },
      weekdayMinutes: {
        title: 'Сколько времени на ужин в будни?',
        description: 'По будням предложим блюда, которые успеете приготовить за это время.',
        hint: 'Дальше: что вы не едите',
      },
      exclusions: {
        title: 'Что вы не едите?',
        description: 'Уберём такие блюда из подборки. Можно ничего не выбирать.',
        hint: 'Ответы можно изменить в профиле',
      },
    },
    next: 'Дальше',
    saving: 'Сохраняем…',
    saveError: 'Не удалось сохранить ответы.',
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
    optionCard: 'OptionCard',
    spinner: 'Spinner',
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
    loading: 'Сохраняем…',
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
    noFish: 'Без рыбы',
    removable: 'кинза',
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
  optionCard: {
    question: 'Кто ест за вашим столом?',
    exclusionsQuestion: 'Что вы не едите?',
  },
  tgMock: {
    /** Stand-in for the Telegram BackButton in the browser (mock Telegram environment). */
    back: 'Назад (кнопка Telegram)',
  },
  errorState: {
    retried: (count: number) => `Нажато «Повторить»: ${String(count)}`,
  },
} as const;
