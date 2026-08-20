FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./
COPY prisma ./prisma

RUN pnpm install

COPY . .

RUN pnpm build

FROM node:20-alpine

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
