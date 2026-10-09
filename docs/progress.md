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

### Смена стека (2026-10-09, ветка docs/stack-node-redux)
- Сделано: ТЗ, AGENTS.md, субагент `spec-reviewer`, скилл `/task`, `guard-edit.sh`, `.gitignore` переведены на Redux Toolkit + RTK Query, Node.js-сервер с Postgres и nginx на VPS без Supabase; менеджер пакетов — npm вместо pnpm (плюс `CLAUDE.md`, `ui-verifier`, `stop-check.sh`).
- Решения: docs/decisions/0001-stack-node-redux-nginx.md
- Права в `.claude/settings.json`: supabase → docker/drizzle-kit, pnpm → npm, запрет ssh/scp/rsync и `npm publish`.

### Харнес (2026-10-09)
- Сделано: AGENTS.md, CLAUDE.md, хуки, субагенты `spec-reviewer` и `ui-verifier`, скилл `/task`, Playwright MCP.
