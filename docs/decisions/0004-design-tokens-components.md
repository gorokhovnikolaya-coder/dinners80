# 0004. Дизайн-токены в Tailwind v4, шрифты, базовые компоненты и `/dev/ui`

Дата: 2026-10-09 · Задача: 03

## Контекст

ТЗ требует взять цвета, шрифты и отступы из [макета](https://claude.ai/artifact/7CiZksb4DEdHmmUus8G2Mn), сделать Tailwind CSS с токенами, базовые компоненты (Button, Card, Chip, TabBar, ProgressBar, Checkbox, Skeleton, ErrorState) и страницу `/dev/ui`, а также задать цвет шапки и фона Telegram из токенов. ТЗ не определяет:

- как хранить токены и где их источник правды;
- как подключать шрифты макета (Google Fonts в России открывается нестабильно);
- нужен ли React Router ради одной dev-страницы;
- API компонентов и что делать с цветами макета, которые не проходят контраст.

## Решение

**Источник токенов — макет.** Макет — 9 артбордов 390 × 844 (Design-холст). Значения сняты с inline-стилей артбордов и сведены в палитру:

| Токен | Значение | Где в макете |
| --- | --- | --- |
| `bg` | `#F3F5F7` | фон экранов, нейтральные теги |
| `surface` | `#FFFFFF` | карточки, таббар, нижние панели |
| `track` / `divider` / `border` | `#E3E7EC` / `#EEF1F4` / `#C9D1DD` | трек сегментов и прогресса / строки в карточках / обводка кнопок |
| `ink` / `ink-2` / `muted` | `#14213D` / `#3D4858` / `#5B6675` | текст / вторичный текст / подписи, неактивные вкладки; `ink` — ещё и тёмная (navy) поверхность |
| `primary` (+ `strong`, `soft`) | `#0F766E` (`#0B5A54`, `#DDF1EE`) | активная вкладка, чекбоксы, кнопка «Позвать друга» |
| `accent` (+ `strong`, `soft`) | `#C2410C` (`#9A3412`, `#FBE3D6`) | главный CTA «Начать готовить», «Новая страна» |
| `navy-2`, `navy-3`, `on-dark-muted`, `amber` | `#1E2D4F`, `#33415C`, `#A9B4C6`, `#F2A65A` | тёмные экраны: онбординг, штамп, пейвол |

Шрифты: **Manrope** (основной, 400–800) и **Unbounded** (заголовки и цифры, 500–700). Шкала текста — 11/12/13/14/15/16/17/19/22/26 px (`text-2xs` … `text-4xl`). Радиусы — семантические: `chip` 8, `segment` 11, `tile` 14, `button` 16, `card` 18, `card-lg` 22, `sheet` 24. Тени: `card` (`0 1px 2px rgb(20 33 61 / .06)`) и `raised` (печать штампа). Отступы — стандартный шаг Tailwind 4 px: все отступы макета (4–24, 56) ему кратны, поле экрана — 20 px (`px-5`).

**Tailwind CSS v4 (4.3) по документации: CSS-first.** Плагин `@tailwindcss/vite`, токены — в `@theme static` в `apps/web/src/styles/index.css`. Это единственный источник правды. Палитра, шкала текста, радиусы и тени Tailwind по умолчанию сброшены (`--color-*: initial` и т. п.), поэтому экраны не могут взять цвет не из макета. `static` выводит все токены как CSS-переменные на `:root`, иначе Tailwind выводит только использованные.

**Цвет шапки и фона Telegram берётся из токена `--color-bg`.** `src/telegram/sdk.ts` читает его через `getComputedStyle` (`src/theme/tokens.ts`: `readColorToken`, `toHexColor` → `#rrggbb`) и передаёт в `setHeaderColor` и `setBgColor`. CSS импортируется первой строкой `main.tsx`. В dev Vite вставляет стили при импорте, а в сборке `<link rel="stylesheet">` блокирует выполнение модульного скрипта, поэтому к моменту `initTelegram()` переменная уже есть. Если её нет, шапка получает ключ темы `bg_color`, а фон не меняется. Константа `APP_BACKGROUND_COLOR` удалена. Mock-окружение сохраняет параметры вызовов в `window.__tgMockParams`, и e2e проверяет, что оба цвета равны `#f3f5f7`.

**Контраст.** Проверены все пары текст/фон из макета (WCAG, формула относительной яркости):

- проходят ≥ 4.5:1 — `ink` на `bg` 14.6; `muted` на `surface`/`bg`/`track` 5.8/5.3/4.7; белый на `primary` 5.5 и на `accent` 5.2; `primary-strong` на `primary-soft` 6.9; `accent-strong` на `accent-soft` 5.9; `ink` на `amber` 7.9; `on-dark-muted` на `ink` 7.6;
- **не проходит `#8A94A3`** (зачёркнутые купленные товары в «Списке покупок») — 3.07:1 на белом. Токен не заведён, отмеченные строки чекбокса — `muted` `#5B6675` (5.8:1) с зачёркиванием. Других корректировок оттенков нет;
- обводка `border` `#C9D1DD` у кнопок и чипов — 1.5:1. Это не текст, а у элементов есть подпись, поэтому граница не обязательна по WCAG 1.4.11.
- Фокус: на всех элементах `:focus-visible` — обводка 2 px `primary` с отступом 2 px, на тёмных кнопках — `amber`.

**Шрифты — самохостинг**, без Google Fonts CDN: пакеты `@fontsource-variable/manrope` и `@fontsource-variable/unbounded` (OFL, вариативные woff2). Свои `@font-face` в `src/styles/fonts.css` подключают только подмножества **кириллица и латиница** (греческий, вьетнамский и `-ext` не нужны), `font-display: swap`, `unicode-range`. Vite кладёт woff2 в `dist/assets` с хешем. Браузер скачивает файл, только если на странице есть символы из его диапазона: Manrope 14.5 + 25 КБ, Unbounded 31 + 51 КБ (латиница Unbounded нужна ради цифр в заголовках). Шрифты не блокируют ни рендер, ни интерактивность: до загрузки текст показывается системным шрифтом (fallback — `system-ui`, `-apple-system`, `Roboto`). Preload не ставим, чтобы шрифты не конкурировали с JS первого экрана.

**Роутинг: `/dev/ui` без React Router.** `src/main.tsx` проверяет `import.meta.env.DEV && location.pathname === '/dev/ui'` и динамически импортирует `src/dev/DevUiPage.tsx`. В `vite build` `DEV` — константа `false`, и Rollup выкидывает ветку вместе с чанком страницы. Строки галереи — отдельный экспорт `ruDevUi` в `src/i18n/ru.ts`: в прод его никто не импортирует, и он вычищается tree-shaking. Поиск по `dist` подтверждает, что там нет ни страницы, ни её строк. React Router появится с первыми экранами (задачи 4–5), а ставить его ради одной dev-страницы — лишний вес в стартовом бандле уже сейчас. Dev-сервер Vite отдаёт `index.html` на любой путь (SPA fallback), поэтому `/dev/ui` открывается напрямую.

**Компоненты** (`apps/web/src/components/`, по файлу на компонент, без внешних UI-библиотек; классы склеивает `cx.ts`):

- `Button` — `variant`: `primary` | `accent` | `secondary` | `ghost` | `inverse` (amber на тёмных экранах); `size`: `md` (48 px) | `lg` (56 px); `fullWidth`, `icon`, все атрибуты `button`, `type="button"` по умолчанию. `IconButton` — кнопка без подписи с обязательным `label` → `aria-label`; `variant`: `surface` | `outline` | `muted` | `dark`; размеры 44 и 56 px.
- `Card` — `as` (`div` | `section` | `article` | `li`), `tone` (`surface` | `inverse`), `padding` (`none` | `sm` | `md`), `radius` (`md` | `lg`).
- `Chip` — без `onToggle` это статичный тег (`tone`: `neutral` | `primary` | `accent` | `badge`), с `selected` + `onToggle` — `button` с `aria-pressed`, высотой 44 px и галочкой в выбранном состоянии (состояние видно не только по цвету). Типы не дают смешать режимы.
- `TabBar` — `nav` с `aria-label`, ссылками `a href` и `aria-current="page"` у активной; `items` (`id`, `label`, `href`, `icon`), `activeId`, `onNavigate` (для будущего роутера: обычный клик не перезагружает страницу). Нижний отступ учитывает `--tg-viewport-safe-area-inset-bottom`. Позиционирование задаёт экран.
- `ProgressBar` — `role="progressbar"`, `aria-valuemin/max/now`, `aria-label` (обязателен), `aria-valuetext`; `variant`: `bar` | `steps` (сегменты шагов готовки и онбординга); `tone`: `light` | `dark`; `size`: 6 | 10 px. Ограничение значения — чистая функция `normalizeProgress` (`progress.ts`).
- `Checkbox` — нативный `input type="checkbox"` внутри `label`, строка ≥ 44 px; управляемый (`checked` + `onChange(checked)`), `label`, `description`, `trailing`, `strikeWhenChecked`, `divider`, `disabled`.
- `Skeleton` — декоративный блок (`aria-hidden`, `motion-safe:animate-pulse`), `shape`: `rect` | `text` | `circle`; `SkeletonGroup` — `role="status"` + `aria-busy` и скрытая подпись «Загрузка…».
- `ErrorState` — иконка, `title` с `role="alert"` (по умолчанию «Не удалось загрузить данные.»), `description`, кнопка «Повторить» при `onRetry`, `retrying` её блокирует.
- `icons.tsx` — stroke-иконки из макета (`aria-hidden`).

Заглушка `App.tsx` переведена на `SkeletonGroup`/`Skeleton` и `ErrorState`. Временный inline-стиль 44 × 44 удалён.

**Размер:** стартовый JS — 116.67 КБ gzip (было 115.35). CSS — 4.8 КБ gzip, и теперь size-limit проверяет и его: отдельная запись «web: initial CSS», лимит 20 КБ.

**Тесты:** Vitest + Testing Library (`@testing-library/react`, `user-event`, `jest-dom`). Компонентные тесты включают jsdom комментарием `// @vitest-environment jsdom`, а общий setup (`src/test/setup.ts`, `test.setupFiles` в `vite.config.ts`) подключает матчеры и `cleanup`.

## Альтернативы

- **JS-конфиг Tailwind (`@config`) с токенами в TS.** Дал бы значения прямо в JS, но это режим совместимости v4. Выбран CSS-first `@theme`, который рекомендует документация.
- **Токены в TS и их копия в CSS с тестом на совпадение.** Тогда было бы два места правды.
- **Google Fonts `<link>`, как в макете.** Внешний CDN может не открываться из России и даёт лишний DNS/TLS на старте.
- **Пакеты `@fontsource-variable/*` целиком (`wght.css`).** В сборку попали бы греческий, вьетнамский и `latin-ext` подмножества, а Unbounded `latin-ext` весит 118 КБ.
- **React Router сейчас.** Вес в стартовом бандле без экранов, которым он нужен.
- **Кастомный (нарисованный) чекбокс.** Нативный с `accent-color` совпадает с макетом и бесплатно даёт доступность.

## Последствия

- Экраны берут цвета, текст и радиусы только из токенов. Палитры Tailwind по умолчанию нет: `bg-red-500` не сгенерируется. Новый токен добавляется в `@theme` с проверкой контраста.
- Задача, которая вводит React Router (4 или 5), переносит выбор `/dev/ui` в роутер. Условие `import.meta.env.DEV` и ленивый импорт нужно сохранить, а `TabBar.onNavigate` подключить к `navigate`.
- Экраны собирают сегментный переключатель «Будни/Выходные», «Эта неделя/Всё время» из своих элементов или выносят его в компонент. В список задачи 3 он не входил.
- Пустое состояние (ТЗ, «три состояния») — отдельного компонента нет; его делает экран или задача, где оно впервые понадобится (Друзья, задача 10).
- Если понадобится ужать шрифты, можно вырезать латиницу Unbounded до цифр и пунктуации (`pyftsubset`) — около −40 КБ.
