# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (kapi-pulse/).
# Construir con:  docker build -f apps/worker/Dockerfile -t kapi-worker .

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile --prefer-offline

ENV NODE_ENV=production
WORKDIR /app/apps/worker
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
