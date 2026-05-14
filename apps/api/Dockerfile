# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (kapi-pulse/).
# Construir con:  docker build -f apps/api/Dockerfile -t kapi-api .

FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

# Copia el monorepo completo (.dockerignore filtra node_modules, dist, .env, etc.)
COPY . .

# Instala todas las dependencias (incluye devDeps porque tsup las necesita para build).
# --no-frozen-lockfile permite que el lock se regenere si hay deps recién agregadas.
RUN NODE_ENV=development pnpm install --no-frozen-lockfile --prefer-offline

# Compila apps/api a dist/
RUN pnpm --filter @kapi/api build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
