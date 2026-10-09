#!/usr/bin/env bash
# SessionStart: даёт агенту краткий контекст — ветка, незакоммиченные файлы, следующая задача из ТЗ.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0
tz="docs/ТЗ Вокруг света за 80 ужинов — Telegram Mini App (MVP).md"

branch=$(git branch --show-current 2>/dev/null)
dirty=$(git status --porcelain 2>/dev/null | wc -l)
next=$(grep -m1 -E '^- \[ \] \*\*[0-9]+\.' "$tz" 2>/dev/null | sed -E 's/^- \[ \] \*\*([0-9]+\.[^*]*)\*\*.*/\1/')

echo "Ветка: ${branch:-нет}; незакоммиченных файлов: $dirty."
[ -n "$next" ] && echo "Следующая невыполненная задача по ТЗ: $next"
exit 0
