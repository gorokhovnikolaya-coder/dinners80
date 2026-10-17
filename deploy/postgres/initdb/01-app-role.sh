#!/bin/sh
# Runs once, on the first start with an empty data volume (decision 0025): the application role
# `tma80` without superuser rights owns the database `tma80`. The server, the worker, migrations
# and the seed connect as it; the superuser `postgres` is left for backups and maintenance.
set -eu

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is not set}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v app_password="$APP_DB_PASSWORD" <<'SQL'
create role tma80 login password :'app_password' nosuperuser nocreatedb nocreaterole noreplication;
create database tma80 owner tma80;
revoke all on database tma80 from public;
grant connect, temporary on database tma80 to tma80;
SQL
