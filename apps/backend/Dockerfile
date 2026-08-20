FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./
COPY prisma ./prisma

RUN pnpm install

# Estágio de dev: usado pelo docker-compose (target: dev), com o código
# montado por volume por cima do que foi copiado aqui e hot-reload via
# `tsx watch`. Mantém pnpm/corepack ativos, diferente do estágio de prod.
FROM base AS dev

COPY . .

EXPOSE 3333

# Aplica migrations já existentes (não cria novas — isso é `prisma migrate
# dev`, rodado manualmente via `docker compose exec backend pnpm
# prisma:migrate` quando o schema mudar) e roda o seed (upsert, idempotente)
# a cada start, pra já subir pronto pra usar num `docker compose up`.
CMD ["sh", "-c", "pnpm prisma:migrate:deploy && pnpm prisma:seed && pnpm dev"]

FROM base AS build

COPY . .

RUN pnpm build

FROM node:20-alpine AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p uploads/receipts && chown -R node:node /app
USER node

EXPOSE 3333

# Usa os binários do Prisma/tsx direto do node_modules em vez de `pnpm exec`:
# em produção não precisamos do corepack/pnpm dentro do container, só dos
# CLIs já instalados como devDependency na etapa de build. O seed roda a
# cada start (é upsert, idempotente) pra não depender de um passo manual
# pós-deploy na plataforma gerenciada.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/tsx prisma/seed.ts && node dist/index.js"]
