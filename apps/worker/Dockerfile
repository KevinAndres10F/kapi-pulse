FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

# Copy all workspace files
COPY . .

# Install ALL dependencies (including devDeps needed for tsup build)
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build the worker app
RUN pnpm --filter @kapi/worker build

# Runtime
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
