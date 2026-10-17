#!/bin/sh
# Runs in the nginx image after the templates are rendered (decision 0025): serves the full site
# when the certificate of DOMAIN exists, otherwise only the ACME challenge on port 80.
set -eu

: "${DOMAIN:?DOMAIN is not set}"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    cp /etc/nginx/app.conf /etc/nginx/site.conf
else
    echo "$0: no certificate for ${DOMAIN} yet, serving only /.well-known/acme-challenge/" >&2
    cp /etc/nginx/acme.conf /etc/nginx/site.conf
fi
