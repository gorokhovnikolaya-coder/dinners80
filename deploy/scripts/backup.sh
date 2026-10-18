#!/bin/sh
# Daily backup (ТЗ, «Хостинг»; decision 0025): the database (pg_dump) and the uploaded files
# (MEDIA_DIR) in one archive deploy/backups/tma80-<UTC time>.tar, copied to BACKUP_REMOTE with
# rclone. The newest BACKUP_KEEP (14 by default) archives are kept here and in the remote.
# Cron on the VPS: 30 3 * * * /srv/tma80/deploy/scripts/backup.sh >> /var/log/tma80-backup.log 2>&1
. "$(dirname "$0")/lib.sh"

# The dump and the photos are private: not readable by other users of the host.
umask 077

remote=$(require_env BACKUP_REMOTE)
keep=$(env_value BACKUP_KEEP)
keep=${keep:-14}
stamp=$(date -u +%Y%m%d-%H%M%S)
name="tma80-$stamp"
mkdir -p backups
work="backups/$name"
trap 'rm -rf "$work" "backups/$name.tar.part"' EXIT
mkdir "$work"

echo "$(date -u +%FT%TZ) backup $name"
compose exec -T postgres pg_dump -U postgres -d tma80 --format=custom > "$work/db.dump"
compose exec -T server tar -C /srv/media -czf - . > "$work/media.tar.gz"
# Written under a temporary name: an incomplete archive never counts as one of the newest.
tar -C backups -cf "backups/$name.tar.part" "$name"
mv "backups/$name.tar.part" "backups/$name.tar"
rm -rf "$work"

rclone copyto "/backups/$name.tar" "$remote/$name.tar"
echo "uploaded $remote/$name.tar ($(du -h "backups/$name.tar" | cut -f1))"

# Retention: names sort by time, everything after the newest $keep goes.
for file in backups/tma80-*.tar; do
    if [ -f "$file" ]; then echo "$file"; fi
done | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f "$old"
done
# No pipefail in POSIX sh: the listing goes to a variable first, so its failure stops the script.
listing=$(rclone lsf --files-only --include 'tma80-*.tar' "$remote")
printf '%s\n' "$listing" | sed '/^$/d' | sort -r | tail -n +"$((keep + 1))" |
    while read -r old; do
        rclone deletefile "$remote/$old"
        echo "removed $remote/$old"
    done
echo "$(date -u +%FT%TZ) done"
