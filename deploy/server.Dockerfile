# Image of the Node server and the worker (decisions 0002, 0025). Build context: the repository
# root. Node 24 runs the TypeScript sources directly, without a build step.
FROM node:24.22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Production dependencies of the server and the shared package only.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --ignore-scripts -w @tma80/server -w @tma80/shared && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/server apps/server
# `npm run db:seed` loads the content from here (with --require-photos the photos must be in place).
COPY content content

# Uploaded photos (MEDIA_DIR): a named volume takes the owner of this folder on first mount.
RUN mkdir -p /srv/media && chown node:node /srv/media
USER node
WORKDIR /app/apps/server
EXPOSE 3080
CMD ["node", "src/index.ts"]
