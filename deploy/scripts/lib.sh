# Shared helpers of the deploy scripts (decision 0025); sourced, not run.
# Works from any folder: compose runs in deploy/ with deploy/.env (TMA80_ENV_FILE overrides it).
set -eu

DEPLOY_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$DEPLOY_DIR"
ENV_FILE=${TMA80_ENV_FILE:-$DEPLOY_DIR/.env}
RCLONE_IMAGE=rclone/rclone:1.71.2

if [ ! -f "$ENV_FILE" ]; then
    echo "No $ENV_FILE: copy deploy/env.example to deploy/.env and fill it in" >&2
    exit 1
fi

compose() {
    docker compose --env-file "$ENV_FILE" "$@"
}

# The value of a variable in the env file (the last assignment wins), empty when unset.
env_value() {
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

# Like env_value, but fails when the variable is empty.
require_env() {
    value=$(env_value "$1")
    if [ -z "$value" ]; then
        echo "$1 is not set in $ENV_FILE" >&2
        exit 1
    fi
    printf '%s\n' "$value"
}

# rclone in Docker with deploy/rclone.conf (made by `rclone config`, see docs/deploy.md) and
# deploy/backups mounted at /backups.
rclone() {
    if [ ! -f "$DEPLOY_DIR/rclone.conf" ]; then
        echo "No deploy/rclone.conf: create it with rclone config (docs/deploy.md)" >&2
        exit 1
    fi
    # As the calling user: downloaded archives stay removable by the retention of backup.sh.
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
        -v "$DEPLOY_DIR/rclone.conf:/config/rclone/rclone.conf" \
        -v "$DEPLOY_DIR/backups:/backups" \
        "$RCLONE_IMAGE" "$@"
}
