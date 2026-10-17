#!/bin/sh
# The first TLS certificate of DOMAIN from Let's Encrypt (HTTP-01 over nginx, decision 0025).
# Run once after deploy.sh, when DNS of DOMAIN already points to the VPS. Renewals are done by the
# certbot service. CERTBOT_STAGING=1 — a test certificate from the staging environment.
. "$(dirname "$0")/lib.sh"

domain=$(require_env DOMAIN)
email=$(require_env LETSENCRYPT_EMAIL)
staging=
if [ "${CERTBOT_STAGING:-}" = 1 ]; then staging=--staging; fi

# Without a certificate nginx serves only /.well-known/acme-challenge/ on port 80.
compose up -d nginx
compose run --rm --entrypoint certbot certbot certonly $staging \
    --webroot -w /var/www/certbot -d "$domain" \
    --email "$email" --agree-tos --no-eff-email --non-interactive
# The entrypoint of nginx picks the full site now that the certificate exists.
compose restart nginx
compose up -d certbot
echo "TLS is on: https://$domain/"
