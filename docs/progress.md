# Прогресс

## Заметки

Проблемы и идеи, замеченные вне текущей задачи. Пункт удаляется, когда его взяли в работу.

- Задача 5: подключить `TabBar.onNavigate` к `navigate` из React Router (роутер и `/dev/ui` в нём — с задачи 4).
- e2e: под высокой нагрузкой машины (load average > 15) сценарии изредка падали по таймауту `page.goto` на холодном dev-сервере; на свободной машине стабильно зелёные. Если повторится в CI — поднять `timeout`/`navigationTimeout` в `playwright.config.ts`.
- Экраны 1 и 6: сегментный переключатель («Будни · до 30 мин / Выходные», «Эта неделя / Всё время») в задачу 3 не входил — собрать на экране или вынести в компонент.

## Журнал

Новые записи — сверху. Шаблон:

```
### Задача NN — <название> (YYYY-MM-DD, ветка task/NN-slug)
- Сделано: …
- Проверено: npm run check ✓, npm run e2e ✓, скриншоты docs/screens/task-NN/
- Решения: docs/decisions/NNNN-… (если были)
- Осталось / сомнения: …
```

### Харнес: экономия лимита (2026-10-10, ветка chore/cheaper-pipeline)
- Сделано: `spec-reviewer` и `ui-verifier` работают на Sonnet (`model: sonnet` во frontmatter); исполнитель, запущенный оркестратором, не запускает ревьюеров — ревью один раз делает оркестратор; продуктовые вопросы исполнитель возвращает до кода; скриншоты `docs/screens/` снимают e2e-сценарии (`shot` в `e2e/fixtures.ts`, `SCREENS=task-NN npm run e2e`), `ui-verifier` смотрит PNG и в браузере проверяет только непокрытое; после правок по ревью оркестратор проверяет дифф правок сам, без полного повторного ревью (CLAUDE.md, скилл `/task`).
- Причина: на доработку задачи 4 ушло ~27 % 5-часового лимита — всё на Opus, ручной проход браузера, второй круг из-за продуктовых вопросов после реализации.

### Задача 04 — Онбординг: решения владельца (2026-10-10, ветка task/04-owner-decisions)
- Сделано: тег `pork` удалён (константы, схемы, фикстуры, правило «мясо ⇒ свинина», блокировка в UI, тесты, e2e), блюда со свининой — `meat`; свои исключения `customExclusions` (`users.custom_exclusions`) в профиле и `PATCH /me`: схема (≤ 10 слов, 2–40 символов с буквой, без повторов с учётом ё = е), `cleanCustomExclusion`/`customExclusionKey`/`normalizeCustomExclusions`/`addCustomExclusion`, `matchesCustomExclusion(dish, words)` для алгоритма подбора — всё в `packages/shared` с юнит-тестами; мок-БД и MSW нормализуют поле, пользователи 1002 и 1004 исключают «свинина» своим словом; поле «Своё» на шаге 3 внутри `ExclusionsField` (Enter/«Добавить», ошибки, чипы с «×» — новый удаляемый вариант `Chip`); онбординг светлый (фон `bg`, шапка Telegram не перекрашивается, заглушка загрузки — светлый скелетон), удалены тёмный тон `OptionCard`/`BackNavigation`, `useTelegramChromeColor`, токены `navy-selected`, `on-dark`; ТЗ обновлено (онбординг, алгоритм подбора, профиль, модель данных, `PATCH /me`, «Принятые решения»), к решениям 0003 и 0005 добавлены пометки.
- Проверено: npm run check ✓ (стартовый JS 133.86 kB gzip из 200 kB, CSS 5.13 kB из 20 kB), npm run e2e ✓ (14 сценариев), скриншоты docs/screens/task-04/ пересняты (06 — свои исключения, 16 — ошибка повтора; 06 «мясо блокирует свинину» удалён)
- Решения: docs/decisions/0006-light-onboarding-custom-exclusions.md
- Осталось / сомнения: подстрока без морфологии («свинина» не найдёт «свининой»); передавать ли свои слова в событие `onboarding_done` — решить в задаче 22.
- После ревью: набранное, но не добавленное слово в «Своё» добавляется при сохранении (`ExclusionsField` `ref.commitPending()`), невалидное — ошибка, фокус в поле, сохранение не уходит (юнит-тест + e2e); мок-блюда получили названия основных ингредиентов (`dishIngredientNames`), пользователи 1002/1004 исключают основу «свин», тест фикстур проверяет, что она исключает ровно 8 бывших pork-блюд; live-регион ошибки всегда в дереве; `maxLength` поля 100 — длинная вставка даёт ошибку, а не обрезается; Prettier по изменённым файлам. Правка инфраструктуры: в `globalIgnores` `eslint.config.js` добавлены `test-results/` и `playwright-report/` — `npm run lint` падал на временных трейсах Playwright во время e2e. Скриншоты шага 3 пересняты, добавлен `17-step3-pending-word-invalid.png`; проверено: npm run check ✓, npm run e2e ✓ (15 сценариев).

### Задача 04 — Онбординг (2026-10-09, ветка task/04-onboarding)
- Сделано: React Router 8.4 (декларативный режим): `/` — заглушка «Ужин сегодня», `/onboarding` — ленивый экран онбординга, перенаправления по `needsOnboarding`, dev-only `/dev/ui` в роутере; онбординг по макету (тёмный экран, сегменты прогресса, «Вопрос N из 3», карточки-варианты, «Дальше»), 3 вопроса, назад — системная кнопка Telegram (шаги 2–3); черновик — ленивый Redux-слайс (`combineSlices` + `injectInto`); `PATCH /me` (схемы `updateMeRequestSchema`/`meResponseSchema`, часовой пояс из `Intl`), обновление кеша `auth` без перезапроса; состояния «Сохраняем…» и ошибка с «Повторить»; правило «мясо ⇒ свинина» в UI (свинина отмечена и заблокирована) и нормализация исключений (`normalizeExclusions`) в `packages/shared`; переиспользуемые контролы `HouseholdField`/`WeekdayMinutesField`/`ExclusionsField` на новом `OptionCard` (тёмный и светлый тон, для профиля); шапка Telegram navy на онбординге; мок: `mocks/db.ts` с sessionStorage, `PATCH /me`, `?mock_error=me`, `?mock_reset=1`, кнопка «Назад» Telegram в mock-окружении; токены `navy-selected`, `on-dark`, `ProgressBar size="xs"`, тёмное неактивное состояние `Button inverse`. Тесты: shared (нормализация, схемы), логика шагов и слайс, контролы (Testing Library), MSW `PATCH /me`; e2e `e2e/onboarding.spec.ts` (4 сценария), `dev-mode.spec.ts` переведён с новичка на 1005.
- После ревью: запасная кнопка «Назад» при недоступной системной (`BackNavigation` + `useTelegramBackButton`, мок `?mock_tg_version=6.0`); проверка IANA в `timezoneSchema`; `lazyScreen` с `ScreenErrorBoundary` («Не удалось открыть экран.» + «Повторить» с повторным импортом, мок `?mock_error=chunk`); мок-БД хранит только патч и флаг онбординга; заглушка «←» Telegram в моке — в верхнем отступе и первой в порядке Tab. Второе ревью: если повторный импорт чанка снова падает (Chrome 144 и старые WebView кэшируют упавший `import()`), «Повторить» перезагружает страницу (юнит-тест + e2e `chunk:always`); спиннер вынесен в `Spinner` и `Button loading` (галерея `/dev/ui`); нижний отступ с safe area Telegram — утилита `pb-safe-*` в `theme.css` (онбординг, `TabBar`). Вынужденная правка инфраструктуры тестов ради зелёного e2e: `e2e/fixtures.ts` — `page.goto` повторяет навигацию, если запрос упал с `net::ERR_NETWORK_CHANGED` (Chromium обрывает запросы при смене сети хоста, например при перезапуске Docker-контейнера), все спеки импортируют `test` оттуда.
- Проверено: npm run check ✓ (стартовый JS 133.55 kB gzip из 200 kB, CSS 5.11 kB из 20 kB), npm run e2e ✓ (14 сценариев), браузер 390 × 844 mock-режим `?user=1001`, скриншоты docs/screens/task-04/
- Решения: docs/decisions/0005-onboarding-routing-patch-me.md
- Осталось / сомнения: вопросы владельцу — подпись «без острого» у «Семья с детьми» из макета не выведена (семья не исключает острое по ТЗ); блокировка свинины при выборе мяса; текст кнопки на последнем шаге («Дальше» по ТЗ); тексты шагов 2–3 и подсказок под вариантами придуманы (в макете только шаг 1); у новичка при входе фон меняется: светлый скелетон (пока идёт `POST /auth`) → тёмная заглушка онбординга (маршрут неизвестен до ответа `auth`).

### Задача 03 — Дизайн-токены и базовые компоненты (2026-10-09, ветка task/03-design-system)
- Сделано: Tailwind CSS 4.3 (`@tailwindcss/vite`), токены из макета в `@theme static` (`apps/web/src/styles/theme.css`: палитра, шрифты, полная шкала текста 10–40 px, интервалы, радиусы, тени; дефолты Tailwind сброшены; кольцо фокуса — переменная, на тёмных поверхностях `surface-dark` → amber); самохостинг Manrope и Unbounded (вариативные woff2, только кириллица + латиница, `font-display: swap`); компоненты `Button`/`IconButton`, `Card`, `Chip`, `TabBar`, `ProgressBar`, `Checkbox`, `Skeleton`/`SkeletonGroup`, `ErrorState`, иконки; dev-only галерея `/dev/ui` (без React Router, выпиливается из сборки); заглушка `App.tsx` на `Skeleton`/`ErrorState`; цвет шапки и фона Telegram читается из `--color-bg`; size-limit считает и стартовый CSS (≤ 20 КБ). Тесты: Testing Library + jsdom (ProgressBar, Checkbox, Chip, TabBar, Skeleton, ErrorState, Button, чтение токенов), e2e `e2e/dev-ui.spec.ts` (8 компонентов, взаимодействие, зоны 44 × 44) и проверка цветов Telegram из токена.
- Проверено: npm run check ✓ (стартовый JS 116.73 kB gzip из 200 kB, CSS 4.75 kB из 20 kB, dev-классы галереи в CSS `dist` не попадают, `/dev/ui` и `ruDevUi` в `dist` нет), npm run e2e ✓ (7 сценариев), браузер 390 × 844 mock-режим, скриншоты docs/screens/task-03/
- Решения: docs/decisions/0004-design-tokens-components.md
- Осталось / сомнения: цвет `#8A94A3` (зачёркнутые покупки в макете) не проходит контраст — заменён на `muted`; высота строки ингредиента 40 px в макете → 44 px; компонента пустого состояния и сегментного переключателя нет (не входили в задачу).

### Задача 02 — Dev-режим (2026-10-09, ветка task/02-dev-mode)
- Сделано: mock-окружение Telegram на `@tma.js/sdk-react` (`mockTelegramEnv`: тема, viewport, safe area; `?user=<id>` + sessionStorage); запуск SDK в `src/telegram/sdk.ts` (`ready`, `expand`, `setHeaderColor`/`setBgColor`, CSS-переменные safe area, всё через `isAvailable`/`ifAvailable`); схемы в `packages/shared` (страна, блюдо, готовка, профиль, подписка, ответ `POST /auth`, ошибки API, константы); фикстуры: 12 стран, 36 блюд, 5 тестовых пользователей + 3 друга; MSW `POST /api/auth` по `Authorization: tma <initData>`; RTK Query (`src/api/`) и store (`src/store/`); экран-заглушка с именем пользователя и состояниями загрузки/ошибки (повтор показывает загрузку, кнопка 44 × 44); управление моком `?mock_error=` / `?mock_delay=`; `npm run e2e` (Playwright, 4 сценария). Попутно: `<link rel="icon" href="data:,">` в `apps/web/index.html` (не было 404 на favicon в консоли); в `eslint.config.js` `allowDefaultProject` сужен до `*.js` и `vitest.config.ts` (`playwright.config.ts` входит в TS-проект `e2e/`), `e2e/**` добавлен к node globals. После ревью: ТЗ обновлено с согласия владельца — SDK `@tma.js/sdk-react`, проверка доступности методов вместо `isVersionAtLeast`, правило «свинина — тоже мясо» (`pork` ⇒ `meat`); фикстуры исправлены (теги, Глеб без свинины, Жанна без глютена — 8 стран), добавлены инварианты; код ошибки `internal` в shared.
- Проверено: npm run check ✓ (стартовый JS 115.35 kB gzip из 200 kB, моков в `dist` нет), npm run e2e ✓, скриншоты docs/screens/task-02/
- Решения: docs/decisions/0003-dev-mode-mocks.md
- Осталось / сомнения: подпись initData для `VITE_API=local` — задачи 15–16; цвет шапки/фона — константа до токенов задачи 3; бюджет стартового бандла после задачи 2 — ~85 kB.

### Задача 01 — Монорепозиторий (2026-10-09, ветка task/01-monorepo)
- Сделано: npm workspaces `apps/web` (Vite 8 + React 19, экран-заглушка, строки в `src/i18n/ru.ts`), `apps/server` (Fastify 5, `GET /api/health`, запуск `node src/index.ts` без сборки), `packages/shared` (схема `healthResponseSchema` на `zod/mini` + тест); TypeScript 6 strict с project references, ESLint 9 (typescript-eslint strict type-checked, react/react-hooks/react-refresh), Prettier, Vitest 5 (projects), size-limit по манифесту Vite; `docker-compose.yml` с Postgres 17 (`127.0.0.1:5433`), `.env.example`; таблица «Команды» в AGENTS.md.
- Проверено: npm run check ✓ (стартовый JS 67.94 kB gzip из 200 kB), npm run build ✓, npm run dev отдаёт страницу, `GET /api/health` → `{"status":"ok"}`, npm run db:up/db:down ✓. UI — только заглушка, e2e и скриншоты появятся с задачи 2.
- Решения: docs/decisions/0002-monorepo-ts-shared-zod-mini.md
- Осталось / сомнения: TypeScript 7 и ESLint 10 не взяты из-за несовместимости typescript-eslint и eslint-plugin-react; `npm run dev` по умолчанию выставляет `VITE_TG_MOCK=1 VITE_API=mock` только в dev, а продакшен-сборка с этими значениями падает; сам mock-режим (SDK-моки, MSW) — в задаче 2; zod type provider для Fastify — выбрать в задаче 14.

### Смена стека (2026-10-09, ветка docs/stack-node-redux)
- Сделано: ТЗ, AGENTS.md, субагент `spec-reviewer`, скилл `/task`, `guard-edit.sh`, `.gitignore` переведены на Redux Toolkit + RTK Query, Node.js-сервер с Postgres и nginx на VPS без Supabase; менеджер пакетов — npm вместо pnpm (плюс `CLAUDE.md`, `ui-verifier`, `stop-check.sh`).
- Решения: docs/decisions/0001-stack-node-redux-nginx.md
- Права в `.claude/settings.json`: supabase → docker/drizzle-kit, pnpm → npm, запрет ssh/scp/rsync и `npm publish`.

### Харнес (2026-10-09)
- Сделано: AGENTS.md, CLAUDE.md, хуки, субагенты `spec-reviewer` и `ui-verifier`, скилл `/task`, Playwright MCP.
