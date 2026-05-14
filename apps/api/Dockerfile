# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (kapi-pulse/).
# Construir con:  docker build -f apps/api/Dockerfile -t kapi-api .

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

# Copia el monorepo completo (el .dockerignore excluye node_modules, .next, dist, etc.)
COPY . .

# Instala dependencias (incluye devDeps porque usamos tsx para correr TS directo)
RUN pnpm install --frozen-lockfile --prefer-offline

ENV NODE_ENV=production
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
