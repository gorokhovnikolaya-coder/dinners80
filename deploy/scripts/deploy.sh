#!/bin/sh
# Deploy or update on the VPS (decision 0025; docs/deploy.md): build the images, apply the
# migrations, load content/ (fails without dish photos) and (re)start the services.
# Run from the repository checkout: deploy/scripts/deploy.sh
. "$(dirname "$0")/lib.sh"

compose build
compose run --rm server node src/db/migrate.ts
compose run --rm server node seed/seed.ts --require-photos
compose up -d --remove-orphans
compose ps
