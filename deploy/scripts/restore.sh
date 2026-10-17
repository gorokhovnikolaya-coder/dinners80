#!/bin/sh
# Restores a backup of backup.sh (decision 0025): REPLACES the database and the uploaded files.
#   deploy/scripts/restore.sh tma80-20261101-033000.tar        # from deploy/backups or the remote
#   deploy/scripts/restore.sh tma80-20261101-033000.tar --yes  # without the question
# The server and the worker are stopped for the time of the restore.
. "$(dirname "$0")/lib.sh"

name=$(basename "${1:?usage: restore.sh <tma80-…tar> [--yes]}")
mkdir -p backups
if [ ! -f "backups/$name" ]; then
    remote=$(require_env BACKUP_REMOTE)
    echo "downloading $remote/$name"
    rclone copyto "$remote/$name" "/backups/$name"
fi
if [ "${2:-}" != --yes ]; then
    printf 'Replace the database and the files with %s? Type yes: ' "$name"
    read -r answer
    [ "$answer" = yes ] || { echo 'cancelled'; exit 1; }
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar -C "$work" -xf "backups/$name"
dump=$(find "$work" -name db.dump)
media=$(find "$work" -name media.tar.gz)

compose stop server worker
compose exec -T postgres pg_restore -U postgres -d tma80 --clean --if-exists --single-transaction < "$dump"
compose run --rm --no-deps -T --entrypoint sh server \
    -c 'find /srv/media -mindepth 1 -delete && tar -xzf - -C /srv/media' < "$media"
compose up -d server worker
echo "restored $name"
