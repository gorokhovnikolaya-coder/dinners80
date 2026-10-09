@AGENTS.md

## Claude Code

- Язык общения и документов — русский; код, идентификаторы и коммиты — на английском.
- Хуки (`.claude/settings.json`):
  - после каждой правки файл форматируется Prettier и чинится ESLint (`.claude/hooks/format-file.sh`);
  - правки `.env*` и уже закоммиченных миграций блокируются (`.claude/hooks/guard-edit.sh`);
  - при остановке запускаются `npm run typecheck` и `npm run lint`; если упали — нужно чинить, прежде чем заканчивать (`.claude/hooks/stop-check.sh`).
- Субагенты: `spec-reviewer` — сверка диффа с ТЗ и AGENTS.md; `ui-verifier` — проверка экрана в браузере и скриншоты.
- Браузер для проверки UI — Playwright MCP (`.mcp.json`).
- Формат коммита: `task NN: <что сделано>` (на английском), в конце — строка Co-Authored-By из системных инструкций.
