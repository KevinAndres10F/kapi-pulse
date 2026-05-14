FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

# Build-time arg (Coolify injects NODE_ENV=production; we force dev for deps)
ARG NODE_ENV=development

# Copy all workspace files
COPY . .

# Install ALL dependencies (including devDeps needed for tsup build)
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build the API app
RUN pnpm --filter @kapi/api build

# Runtime
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
