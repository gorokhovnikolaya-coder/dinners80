#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): запрещает правку секретов и уже закоммиченных миграций.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file#"$root"/}"
name=$(basename "$file")

case "$name" in
  .env.example) ;;
  .env | .env.*)
    echo "Правка $rel запрещена: файлы .env* содержат секреты и правятся только человеком. Пример значений — в .env.example." >&2
    exit 2
    ;;
esac

case "$rel" in
  apps/server/migrations/*.sql)
    if git -C "$root" cat-file -e "main:$rel" 2>/dev/null; then
      echo "Миграция $rel уже в main — её нельзя менять. Создай новую миграцию." >&2
      exit 2
    fi
    ;;
esac
exit 0
