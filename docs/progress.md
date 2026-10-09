# Прогресс

## Заметки

Проблемы и идеи, замеченные вне текущей задачи. Пункт удаляется, когда его взяли в работу.

## Журнал

Новые записи — сверху. Шаблон:

```
### Задача NN — <название> (YYYY-MM-DD, ветка task/NN-slug)
- Сделано: …
- Проверено: npm run check ✓, npm run e2e ✓, скриншоты docs/screens/task-NN/
- Решения: docs/decisions/NNNN-… (если были)
- Осталось / сомнения: …
```

### Задача 02 — Dev-режим (2026-10-09, ветка task/02-dev-mode)
- Сделано: mock-окружение Telegram на `@tma.js/sdk-react` (`mockTelegramEnv`: тема, viewport, safe area; `?user=<id>` + sessionStorage); запуск SDK в `src/telegram/sdk.ts` (`ready`, `expand`, `setHeaderColor`/`setBgColor`, CSS-переменные safe area, всё через `isAvailable`/`ifAvailable`); схемы в `packages/shared` (страна, блюдо, готовка, профиль, подписка, ответ `POST /auth`, ошибки API, константы); фикстуры: 12 стран, 36 блюд, 5 тестовых пользователей + 3 друга; MSW `POST /api/auth` по `Authorization: tma <initData>`; RTK Query (`src/api/`) и store (`src/store/`); экран-заглушка с именем пользователя и состояниями загрузки/ошибки; `npm run e2e` (Playwright, 3 сценария).
- Проверено: npm run check ✓ (стартовый JS 115.35 kB gzip из 200 kB, моков в `dist` нет), npm run e2e ✓, скриншоты docs/screens/task-02/
- Решения: docs/decisions/0003-dev-mode-mocks.md
- Осталось / сомнения: в ТЗ (стек) указан `@telegram-apps/sdk-react`, а используется его преемник `@tma.js/sdk-react`; подпись initData для `VITE_API=local` — задачи 15–16; цвет шапки/фона — константа до токенов задачи 3; бюджет стартового бандла после задачи 2 — ~85 kB.

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
