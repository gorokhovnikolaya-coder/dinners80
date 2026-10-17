# nginx with the mini app build and the content photos (decision 0025). Build context: the
# repository root. VITE_* are build arguments: they end up in the public bundle, no secrets here.
FROM node:24.22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @tma80/web -w @tma80/shared

COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

ARG VITE_API_URL=/api
ARG VITE_BOT_USERNAME
ARG VITE_APP_SHORT_NAME
ARG VITE_TERMS_URL
ARG VITE_PRIVACY_URL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_BOT_USERNAME=$VITE_BOT_USERNAME \
    VITE_APP_SHORT_NAME=$VITE_APP_SHORT_NAME \
    VITE_TERMS_URL=$VITE_TERMS_URL \
    VITE_PRIVACY_URL=$VITE_PRIVACY_URL
RUN npm run build -w @tma80/web && rm -rf apps/web/dist/.vite

# Only the photos of the content: the recipes themselves are served by the API behind the paywall.
COPY content content
RUN mkdir -p /out/content && cd content \
    && find . -type f -name '*.webp' -exec sh -c 'mkdir -p "/out/content/$(dirname "$1")" && cp "$1" "/out/content/$1"' _ {} \;

FROM nginx:1.28-alpine
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/templates /etc/nginx/templates
COPY --chmod=755 deploy/nginx/docker-entrypoint.d/40-select-site.sh /docker-entrypoint.d/
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /var/www/certbot
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /out/content /usr/share/nginx/content
