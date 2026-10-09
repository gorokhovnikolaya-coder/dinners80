# Прогресс

## Заметки

Проблемы и идеи, замеченные вне текущей задачи. Пункт удаляется, когда его взяли в работу.

- Задачи 4–5: при введении React Router перенести `/dev/ui` в роутер (оставить под `import.meta.env.DEV` и с ленивым импортом) и подключить `TabBar.onNavigate` к `navigate`.
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
