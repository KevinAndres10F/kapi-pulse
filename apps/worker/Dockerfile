# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (kapi-pulse/).
# Construir con:  docker build -f apps/worker/Dockerfile -t kapi-worker .

FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY . .

RUN NODE_ENV=development pnpm install --no-frozen-lockfile --prefer-offline

RUN pnpm --filter @kapi/worker build

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
