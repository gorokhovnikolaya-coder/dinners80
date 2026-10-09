#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): форматирует изменённый файл Prettier и чинит ESLint.
# Не блокирует: ошибки линтера поймает stop-check.sh.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] || [ ! -f "$file" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
bin="$root/node_modules/.bin"
[ -x "$bin/prettier" ] || exit 0  # монорепозиторий ещё не поднят (задача 1)

case "$file" in
  "$root"/node_modules/* | "$root"/.git/* | */dist/* ) exit 0 ;;
esac

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    "$bin/prettier" --write --log-level=warn "$file" >/dev/null 2>&1
    [ -x "$bin/eslint" ] && "$bin/eslint" --fix --no-warn-ignored "$file" >/dev/null 2>&1
    ;;
  *.json | *.css | *.md | *.yml | *.yaml | *.html)
    "$bin/prettier" --write --log-level=warn "$file" >/dev/null 2>&1
    ;;
esac
exit 0
