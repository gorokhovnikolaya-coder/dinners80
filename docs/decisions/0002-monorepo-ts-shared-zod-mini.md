# 0002. Монорепозиторий: общий код без сборки, сервер на нативном TypeScript Node 24, схемы на `zod/mini`

Дата: 2026-10-09 · Задача: 01

## Контекст

ТЗ задаёт npm workspaces, TypeScript project references, ESLint, Prettier, Vitest и size-limit, но не говорит:

- как `apps/web` и `apps/server` подключают `packages/shared` — собранным или исходниками;
- чем запускать TypeScript на сервере;
- как совместить «zod-схемы общие для клиента и сервера» с «на клиенте `zod/mini`» (НФТ, производительность);
- какие версии инструментов брать, если последние несовместимы между собой.

## Решение

**`packages/shared` подключается исходниками.** В `package.json` пакета `"exports": { ".": "./src/index.ts" }`, отдельной сборки нет. Vite компилирует его вместе с приложением. Node находит его по симлинку из `node_modules`, переходит по нему к реальному пути `packages/shared/src`, а значит, к файлу применяется type stripping: запрет на `.ts` внутри `node_modules` сюда не относится. Для `tsc -b` у каждого пакета `composite` + `emitDeclarationOnly` в `.tsbuild/` (папка в `.gitignore`), web и server ссылаются на shared через `references`.

**Сервер запускается нативным type stripping Node 24** (стабилен с v24.12, без предупреждений): `node src/index.ts`, в разработке `node --watch --env-file-if-exists=../../.env src/index.ts`. Ни tsx, ни шага сборки сервера нет. Из этого следуют правила для `apps/server` и `packages/shared`, которые закреплены в `tsconfig.base.json`:

- относительные импорты с расширением `.ts` (`allowImportingTsExtensions`);
- только стираемый синтаксис (`erasableSyntaxOnly`): без `enum`, `namespace` с кодом, parameter properties;
- импорты типов — через `import type` (`verbatimModuleSyntax`, правило `consistent-type-imports`);
- `paths` из tsconfig не работают в рантайме, их не используем.

Для единообразия web следует тем же правилам (общий `tsconfig.base.json`).

**Схемы пишутся на `zod/mini` и используются и клиентом, и сервером.** По zod.dev классические и mini-схемы — подклассы одних и тех же классов `zod/v4/core` с одинаковой внутренней частью, отличаются только набором методов. Mini-схемы умеют `.parse` / `.safeParse`, `z.infer` работает. Если писать общие схемы на `zod/mini`, в клиентский бандл не попадёт классический zod: по zod.dev он примерно в 3 раза тяжелее в gzip. Сервер может импортировать из `zod/mini` те же схемы и при желании использовать классический `zod` для собственных схем, потому что ядро одно.

**Версии инструментов.** Ставим последние стабильные, кроме двух случаев, где они несовместимы:

- **TypeScript 6.0** вместо 7.0: typescript-eslint 8.x требует `typescript <6.1`.
- **ESLint 9.39** вместо 10: `eslint-plugin-react` 7.37 поддерживает ESLint до `^9.7`.

Остальное: Vite 8, `@vitejs/plugin-react` 6, React 19.3, Vitest 5, size-limit 14 (`@size-limit/file`), Fastify 5.12, zod 4.6, Prettier 3.9, typescript-eslint 8.71, `@types/node` 24.

**size-limit считает стартовый JS по манифесту Vite.** У web включён `build.manifest`. `.size-limit.js` читает `apps/web/dist/.vite/manifest.json` и берёт entry-чанк и всё, что он импортирует статически. Ленивые экраны (`dynamicImports`) в лимит 200 КБ не входят, как и требует ТЗ.

**Прочее:**

- Один `.env` в корне репозитория: Vite читает его через `envDir: '../..'`, сервер — через `--env-file-if-exists`, Docker Compose — сам.
- Mock-флаги действуют только в dev. `apps/web/vite.config.ts` при `vite` (serve) подставляет `VITE_TG_MOCK=1` и `VITE_API=mock`, если они не заданы в `.env` или окружении, а продакшен-сборка (`vite build`, mode `production`) падает с ошибкой, если `VITE_TG_MOCK=1` или `VITE_API=mock` всё же пришли из `.env`. В `.env.example` эти строки закомментированы. Закоммиченный `.env.development` не подошёл: `.gitignore` и хук `guard-edit.sh` закрывают все `.env.*`, кроме `.env.example`. Флаги в скрипте `dev` тоже не подошли: переменные из окружения важнее `.env`, и переключить dev на `VITE_API=local` через `.env` стало бы нельзя.
- `GET /api/health` — служебный эндпоинт для проверки, что сервер жив (в ТЗ его нет). В задаче 23 он используется как healthcheck для Docker и nginx.
- Локальный Postgres слушает `127.0.0.1:5433`, а не 5432, чтобы не конфликтовать с системным Postgres. Порт меняется переменной `POSTGRES_PORT`.
- Сервер по умолчанию слушает порт 3080, переменная `PORT`.
- ESLint: `strictTypeChecked` + `stylisticTypeChecked`, для `apps/web/src` — react, react-hooks, react-refresh (vite), в конце — `eslint-config-prettier`.
- Vitest: `projects: ['packages/*', 'apps/*']`, web подхватывает свой `vite.config.ts`.

## Альтернативы

- **Собирать shared в `dist`** (tsc или tsup). Нужен лишний шаг перед dev и тестами, легко получить устаревшую сборку. Не нужен, раз оба потребителя понимают TS.
- **tsx для сервера.** Лишняя зависимость. Зато он поддерживает enum и импорты без расширений. Остаётся запасным вариантом, если нативного stripping не хватит.
- **`tsc` → `dist` для сервера.** Отдельный артефакт сборки. Нужен только тогда, когда понадобятся декораторы или enum, а нам они не нужны.
- **Классический `zod` в shared и `zod/mini` только на клиенте.** Пришлось бы описывать схемы дважды, а это противоречит правилу «контракт — только схемы из shared».
- **TypeScript 7 / ESLint 10.** Пока несовместимы с typescript-eslint и eslint-plugin-react. Вернуться к ним, когда плагины их поддержат.
- **Bind-mount `.data/` для Postgres.** На Linux файлы получают владельца uid контейнера, и обычный пользователь не может их удалить. Выбран именованный том.

## Последствия

- В новом коде обязательны расширения в относительных импортах и только стираемый синтаксис. Это правило есть в AGENTS.md.
- Задача 14 (Fastify + схемы): чтобы валидировать запросы и ответы через zod, понадобится type provider, совместимый с `zod/v4/core` (принимает и mini-схемы), или ручная проверка `schema.parse` в обработчиках. Это нужно выбрать и проверить в задаче 14.
- У `zod/mini` нет английской локали по умолчанию: сообщения об ошибках — «Invalid input». Если на сервере понадобятся понятные сообщения (например, в seed-скрипте задачи 14), нужно подключить `z.config(en())`.
- Docker-образ сервера (задача 23) запускает `node src/index.ts` вместе с workspace-симлинком на `packages/shared`, без шага сборки.
- `dist/.vite/manifest.json` попадает в статику. В nginx (задача 23) его можно не раздавать.
