FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

ARG NODE_ENV=development

COPY . .

RUN NODE_ENV=development pnpm install --frozen-lockfile

RUN pnpm --filter @kapi/worker build

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
