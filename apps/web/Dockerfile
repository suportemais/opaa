FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm -r install --frozen-lockfile

COPY apps/web apps/web

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_APP_BASE_DOMAIN
ENV VITE_APP_BASE_DOMAIN=$VITE_APP_BASE_DOMAIN

RUN pnpm --filter web build

FROM nginx:stable-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
