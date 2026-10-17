#!/bin/sh
# Availability check of the production domain (ТЗ, «Хостинг»; docs/deploy.md): run it from
# different networks (mobile operators, home providers in Russia) and keep the output.
#   deploy/scripts/check-availability.sh https://<DOMAIN>
# INSECURE=1 skips the certificate check (local test with a self-signed certificate).
set -u

base=${1:?usage: check-availability.sh https://<domain>}
base=${base%/}
insecure=
if [ "${INSECURE:-}" = 1 ]; then insecure=-k; fi
failed=0
timing='%{http_code} dns=%{time_namelookup}s tcp=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s ip=%{remote_ip}'

# check <path> <expected HTTP status>
check() {
    result=$(curl $insecure -sS -o /dev/null --max-time 15 -w "$timing" "$base$1" 2>&1)
    status=${result%% *}
    if [ "$status" = "$2" ]; then
        echo "OK    $1 $result"
    else
        echo "FAIL  $1 (expected $2) $result"
        failed=1
    fi
}

echo "$(date -u +%FT%TZ) $base from $(curl -sS --max-time 10 https://ifconfig.me 2>/dev/null || echo 'unknown IP')"
check / 200
check /api/health 200
check /media/share/00000000-0000-0000-0000-000000000000.jpg 404
check /media/cooks/x/y.jpg 403
host=${base#https://}
host=${host%%/*}
if command -v openssl >/dev/null 2>&1; then
    expiry=$(echo | openssl s_client -connect "$host:443" -servername "${host%%:*}" 2>/dev/null |
        openssl x509 -noout -enddate 2>/dev/null)
    echo "TLS   ${expiry:-certificate not read}"
fi
if [ "$failed" = 0 ]; then echo 'all checks passed'; else echo 'some checks FAILED'; fi
exit "$failed"
