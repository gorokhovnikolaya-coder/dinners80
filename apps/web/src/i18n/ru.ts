/** Russian plural form for a count: `plural(n, 'блюдо', 'блюда', 'блюд')`. */
const plural = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** All user-facing strings of the mini app. */
export const ru = {
  app: {
    title: 'Вокруг света за 80 ужинов',
  },
  home: {
    title: 'Что на ужин сегодня?',
    profile: (name: string) => `Профиль: ${name}`,
    countries: {
      label: 'стран',
      /** Accessible name of the counter tile that opens the map. */
      link: (count: number, total: number) =>
        `Пройдено стран: ${String(count)} из ${String(total)}. Открыть карту`,
    },
    modes: {
      label: 'Подборка',
      weekday: 'Будни',
      weekdayWithMinutes: (minutes: number) => `Будни · до ${String(minutes)} мин`,
      weekend: 'Выходные',
    },
    suggestions: 'Предложения на ужин',
    minutes: (minutes: number) => `${String(minutes)} мин`,
    levels: { weekday: 'Будний вечер', weekend: 'Выходные', challenge: 'Вызов' },
    labels: {
      newCountry: 'Новая страна',
      newCountryShort: 'Новая',
      nthDish: (n: number) => `${String(n)}-е блюдо`,
      cookedBefore: 'Уже готовили',
    },
    locked: 'Откроется с подпиской',
    showMore: 'Показать другие',
    empty: {
      title: 'Под ваши ограничения блюд не нашлось',
      action: 'Изменить исключения',
    },
  },
  dish: {
    photo: (title: string) => `Фото: ${title}`,
    fact: 'Интересный факт',
    time: 'Время',
    level: 'Уровень',
    servings: {
      label: 'Порции',
      /** «порция» / «порции» / «порций» for the count. */
      word: (count: number) => {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return 'порция';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'порции';
        return 'порций';
      },
      minusSign: '−',
      plusSign: '+',
      fewer: 'Меньше порций',
      more: 'Больше порций',
    },
    ingredients: {
      title: 'Ингредиенты',
      hint: 'отметьте, что есть дома',
    },
    toTaste: 'по вкусу',
    units: {
      g: 'г',
      ml: 'мл',
      pcs: 'шт',
      tbsp: 'ст. л.',
      tsp: 'ч. л.',
      clove: 'зубч.',
      pinch: 'щеп.',
    },
    cart: 'В список покупок',
    cartAllAtHome: 'Всё есть дома — покупать нечего',
    added: (count: number) => `Добавлено в список покупок: ${String(count)}`,
    openShopping: 'Открыть список',
    addError: 'Не удалось добавить в список покупок. Попробуйте ещё раз.',
    startCooking: 'Начать готовить',
    notFound: {
      title: 'Блюдо не найдено',
      action: 'На главную',
    },
  },
  cooking: {
    close: 'Закрыть режим готовки',
    progress: (step: number, total: number) => `${String(step)} / ${String(total)}`,
    progressLabel: 'Шаги рецепта',
    progressValue: (step: number, total: number) => `Шаг ${String(step)} из ${String(total)}`,
    step: (step: number) => `Шаг ${String(step)}`,
    timer: {
      start: 'Запустить таймер',
      pause: 'Пауза',
      resume: 'Продолжить',
      done: 'Время вышло',
      reset: 'Сбросить таймер',
    },
    otherTimers: 'Таймеры других шагов',
    otherTimer: (step: number, time: string) => `Шаг ${String(step)} · ${time}`,
    otherTimerDone: (step: number) => `Шаг ${String(step)} · время вышло`,
    timerDone: (step: number) => `Шаг ${String(step)}: время вышло`,
    screenOn: 'Экран не погаснет, пока вы готовите',
    back: 'Назад',
    next: 'Следующий шаг',
    finish: 'Готово!',
  },
  cooked: {
    photo: {
      title: 'Сфотографируйте блюдо',
      description: 'Фото увидите вы и ваши друзья',
      take: 'Сфотографировать',
      skip: 'Без фото',
      uploading: 'Загружаем фото…',
      uploadError: 'Не удалось загрузить фото',
      retry: 'Повторить',
      continueWithout: 'Продолжить без фото',
    },
    saving: 'Сохраняем…',
    saveError: 'Не удалось сохранить готовку',
    rateLimited: (limit: number) =>
      `Сегодня уже ${String(limit)} готовок — это дневной лимит. Попробуйте завтра`,
    toHome: 'На главную',
    newCountry: 'Новая страна!',
    repeat: 'Блюдо засчитано',
    inPassport: (country: string) => `${country} в паспорте`,
    dishLine: (name: string, n: number) => `${name} · ${String(n)}-е блюдо`,
    countries: (count: number, total: number) => `${String(count)} из ${String(total)} стран`,
    countriesLabel: 'Пройдено стран',
    plusToday: '+1 сегодня',
    overtook: (name: string) => `${name} теперь позади вас в рейтинге друзей`,
    stamp: {
      label: (country: string, date: string) => `Штамп: ${country}, ${date}`,
      caption: 'Вокруг света',
    },
    yourPhoto: (title: string) => `Ваше фото: ${title}`,
    dishPhoto: (title: string) => `Фото: ${title}`,
    openMap: 'Открыть карту',
    share: {
      button: 'Поделиться карточкой',
      title: 'Поделиться карточкой',
      story: 'В историю',
      chat: 'Отправить в чат',
      cancel: 'Отмена',
      preparing: 'Готовим карточку…',
      error: 'Не удалось подготовить карточку',
      retry: 'Повторить',
      /** Texts drawn on the 1080 × 1920 card. */
      card: {
        brand: 'Вокруг света за 80 ужинов',
        cta: 'Присоединяйся — посоревнуемся!',
      },
      /** Story caption (≤ 200 characters): the headline, the counter and the invite link. */
      storyText: (headline: string, counter: string, link: string) =>
        `${headline}! ${counter}. Собираю штампы за ужинами — присоединяйся: ${link}`,
      /** A shorter story caption when the full one is too long. */
      storyTextShort: (link: string) => `Собираю штампы за ужинами — присоединяйся: ${link}`,
      /** Name of the story link widget (Premium only, ≤ 48 characters). */
      storyLink: 'Открыть',
      /** The repeated dish headline of the story caption. */
      repeatHeadline: (dish: string) => `${dish} — блюдо засчитано`,
      /**
       * The `t.me/share/url` fallback text (the invite link goes as the URL); the same words as the
       * caption of the server's share message.
       */
      messageText: (newCountry: boolean, country: string, dish: string, counter: string) =>
        `${newCountry ? `${country} в паспорте — уже ${counter}!` : `${dish} — блюдо засчитано, уже ${counter}!`} ` +
        'Готовлю ужины из кухонь разных стран и собираю штампы. Присоединяйся — посоревнуемся!',
    },
  },
  map: {
    title: 'Мой паспорт',
    /** «13 блюд»: all cooks of the user, repeats included. */
    dishes: (count: number) => `${String(count)} ${plural(count, 'блюдо', 'блюда', 'блюд')}`,
    countriesCaption: 'стран пройдено',
    progressLabel: 'Пройдено стран',
    progressValue: (count: number, total: number) => `${String(count)} из ${String(total)} стран`,
    continents: {
      europe: 'Европа',
      asia: 'Азия',
      americas: 'Америка',
      africa_oceania: 'Африка и Океания',
    },
    continentProgress: (passed: number, total: number) => `${String(passed)} из ${String(total)}`,
    /** Hidden before «3 из 8» for screen readers. */
    continentProgressPrefix: 'пройдено',
    tile: {
      passed: (name: string) => `${name}: пройдена`,
      open: (name: string) => `${name}: не пройдена`,
      locked: (name: string) => `${name}: откроется с подпиской`,
    },
  },
  country: {
    since: (date: string) => `В паспорте с ${date}`,
    notPassed: 'Ещё не пройдена',
    locked: 'Откроется с подпиской',
    dishes: 'Блюда страны',
    cooked: 'Приготовлено',
    notFound: {
      title: 'Страна не найдена',
      action: 'К карте',
    },
  },
  friends: {
    title: 'Друзья',
    periods: {
      label: 'Период рейтинга',
      week: 'Эта неделя',
      all: 'Всё время',
    },
    leaderboard: 'Рейтинг друзей',
    me: 'Вы',
    /** Initial in the user's own avatar. */
    meInitial: 'Я',
    /** Hidden before the place number for screen readers. */
    place: (place: number) => `${String(place)}-е место`,
    dishes: (count: number) => `${String(count)} ${plural(count, 'блюдо', 'блюда', 'блюд')}`,
    countries: (count: number) => `${String(count)} ${plural(count, 'страна', 'страны', 'стран')}`,
    feed: {
      title: 'Последние штампы',
      empty: 'У друзей пока нет штампов',
      inPassport: (country: string) => `${country} в паспорте`,
      photo: (dish: string) => `Фото: ${dish}`,
      error: 'Не удалось загрузить штампы друзей.',
      time: {
        justNow: 'только что',
        minutes: (count: number) => `${String(count)} мин назад`,
        hours: (count: number) => `${String(count)} ч назад`,
        yesterday: 'вчера',
      },
    },
    empty: 'Позовите друзей, чтобы соревноваться',
    invite: 'Позвать друга в Telegram',
    inviteText:
      'Готовлю ужины из кухонь разных стран и собираю штампы в паспорт. Присоединяйся — посоревнуемся!',
  },
  shopping: {
    title: 'Покупки',
    /** The cart button on the main screen; `count` — rows not bought yet. */
    open: (count: number) =>
      count > 0 ? `Список покупок: осталось купить ${String(count)}` : 'Список покупок',
    /** «2 блюда · куплено 2 из 7». */
    summary: (dishes: number, checked: number, total: number) =>
      `${String(dishes)} ${plural(dishes, 'блюдо', 'блюда', 'блюд')} · куплено ${String(checked)} из ${String(total)}`,
    aisles: {
      meat: 'Мясо и рыба',
      veg: 'Овощи и зелень',
      dairy: 'Молочное',
      grocery: 'Бакалея',
      other: 'Другое',
    },
    clear: 'Очистить купленное',
    clearing: 'Очищаем…',
    clearError: 'Не удалось очистить купленное. Попробуйте ещё раз.',
    checkError: 'Не удалось сохранить отметку. Попробуйте ещё раз.',
    send: 'Отправить список в чат',
    /** Text of the list sent to a chat: a heading, then the aisles with their rows. */
    shareTitle: 'Список покупок',
    shareRow: (name: string, amount: string) => `• ${name} — ${amount}`,
    empty: {
      title: 'Список покупок пуст',
      description: 'Добавляйте недостающее с карточки блюда — кнопкой корзины',
      action: 'Выбрать ужин',
    },
  },
  paywall: {
    /** Accessible name of the mini-map of passed countries. */
    map: (passed: number, total: number) =>
      `Карта: пройдено ${String(passed)} из ${String(total)} стран`,
    /**
     * Lines of the title: «10 стран позади.» «Ещё 20 ждут вас»; no countries yet — «30 стран
     * ждут вас»; all passed — «Все 30 стран позади». `total` — published countries.
     */
    title: (passed: number, total: number): readonly string[] => {
      const countries = (count: number) =>
        `${String(count)} ${plural(count, 'страна', 'страны', 'стран')}`;
      const wait = (count: number) => plural(count, 'ждёт', 'ждут', 'ждут');
      if (passed <= 0) return [`${countries(total)} ${wait(total)} вас`];
      if (passed >= total) return [`Все ${countries(total)} позади`];
      const left = total - passed;
      return [`${countries(passed)} позади.`, `Ещё ${String(left)} ${wait(left)} вас`];
    },
    subtitle: {
      /** Opened from a dish of a closed country (the name stays in the nominative). */
      country: (country: string) =>
        `${country} откроется с подпиской. Ваш паспорт и штампы останутся с вами.`,
      /** Opened from the profile. */
      all: 'С подпиской откроются все страны. Ваш паспорт и штампы останутся с вами.',
      active: 'Подписка открыла все страны.',
    },
    benefits: {
      label: 'Что даёт подписка',
      all: (countries: number, dishes: number) =>
        `Все ${String(countries)} ${plural(countries, 'страна', 'страны', 'стран')} и ${String(dishes)} ${plural(dishes, 'проверенный рецепт', 'проверенных рецепта', 'проверенных рецептов')}`,
      suggestions: 'Новые страны в ежедневной подборке ужинов',
      passport: (countries: number) =>
        `Весь паспорт: штампы всех ${String(countries)} ${plural(countries, 'страны', 'стран', 'стран')}`,
    },
    plans: {
      label: 'Тариф',
      year: {
        title: 'Год',
        badge: 'Выгоднее',
        perMonth: (stars: string) => `≈ ${stars} в месяц`,
      },
      month: {
        title: 'Месяц',
        renews: (days: number) =>
          `Продлевается каждые ${String(days)} ${plural(days, 'день', 'дня', 'дней')}`,
      },
    },
    /** «1 200 Stars». */
    stars: (amount: number) => `${new Intl.NumberFormat('ru-RU').format(amount)} Stars`,
    pay: 'Продолжить путешествие',
    opening: 'Открываем оплату…',
    confirming: 'Подтверждаем оплату…',
    refresh: 'Обновить',
    retry: 'Повторить',
    notNow: 'Не сейчас',
    status: {
      failed: 'Оплата не прошла. Попробуйте ещё раз',
      pending: 'Платёж обрабатывается. Подписка включится, как только Telegram его подтвердит',
      unconfirmed: 'Оплата прошла, подписка включится в течение минуты',
      invoiceError: 'Не удалось открыть оплату',
    },
    /** Instead of the plans when the subscription is active; `date` — «5 ноября». */
    active: (date: string) => `Подписка активна до ${date}`,
    /** The server sent no end date (should not happen for an active subscription). */
    activeNoDate: 'Подписка активна',
    /** «Продолжить путешествие» of an active subscription closes the paywall. */
    continue: 'Продолжить путешествие',
  },
  profile: {
    title: 'Профиль',
    username: (username: string) => `@${username}`,
    /** «8 из 30 стран»: passed of the published countries. */
    countries: (count: number, total: number) =>
      `${String(count)} из ${String(total)} ${plural(total, 'страны', 'стран', 'стран')}`,
    /** «13 блюд»: all cooks of the user, repeats included. */
    dishes: (count: number) => `${String(count)} ${plural(count, 'блюдо', 'блюда', 'блюд')}`,
    reminder: {
      title: 'Напоминание об ужине',
      description: 'Бот пришлёт идею ужина в выбранное время',
      time: 'Время',
      /** The client cannot ask to let the bot write (`requestWriteAccess`, Mini Apps < 6.9). */
      updateTelegram: 'Обновите Telegram, чтобы включить напоминания',
    },
    subscription: {
      title: 'Подписка',
      /** `date` — «5 ноября». */
      active: (date: string) => `Подписка активна до ${date}`,
      /** The server sent no end date (should not happen for an active subscription). */
      activeNoDate: 'Подписка активна',
      expired: (date: string) => `Подписка закончилась ${date}`,
      free: (count: number) =>
        `Бесплатно — ${String(count)} ${plural(count, 'страна', 'страны', 'стран')} на выбор`,
      open: 'Открыть все страны',
    },
    preferences: {
      household: 'Кто ест',
      weekdayMinutes: 'Время на ужин в будни',
      exclusions: 'Что не едите',
    },
    documents: {
      title: 'Документы',
      terms: 'Условия использования',
      privacy: 'Политика конфиденциальности',
    },
    saveError: 'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.',
    retry: 'Повторить',
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
    segmentedControl: 'SegmentedControl',
    switch: 'Switch',
  },
  switches: {
    on: 'Напоминание об ужине',
    onDescription: 'Бот пришлёт идею ужина в выбранное время',
    off: 'Звук таймера',
    disabled: 'Недоступный переключатель',
  },
  segmented: {
    label: 'Период',
    week: 'Эта неделя',
    all: 'Всё время',
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
    outlineDark: 'Открыть карту',
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
