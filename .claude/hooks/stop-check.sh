#!/usr/bin/env bash
# Stop: не даёт агенту закончить, пока падают typecheck или lint.
# После 3 неудачных попыток подряд отпускает, чтобы не зациклиться, — агент должен сообщить об ошибках.
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0

# Монорепозиторий ещё не поднят (задача 1) — проверять нечего.
[ -f package.json ] && [ -d node_modules ] || exit 0

# Нет изменений в коде относительно HEAD — проверять нечего.
if [ -z "$(git status --porcelain -- . ':!docs' 2>/dev/null)" ]; then
  exit 0
fi

state_dir="$root/.claude/.state"
mkdir -p "$state_dir"
counter="$state_dir/stop-check-failures"

out=$( { pnpm -s typecheck && pnpm -s lint; } 2>&1 )
if [ $? -eq 0 ]; then
  rm -f "$counter"
  exit 0
fi

n=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 ))
echo "$n" >"$counter"
if [ "$n" -ge 3 ]; then
  rm -f "$counter"
  echo "typecheck/lint падают третий раз подряд — останавливаюсь. Сообщи пользователю, какие ошибки остались." >&2
  exit 0
fi

{
  echo "pnpm typecheck / pnpm lint не проходят (попытка $n из 3). Исправь ошибки, прежде чем заканчивать:"
  echo "$out" | tail -n 60
} >&2
exit 2
