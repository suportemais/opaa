FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm -r install --frozen-lockfile

COPY apps/api apps/api

RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts /app/apps/api/prisma.config.ts
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
