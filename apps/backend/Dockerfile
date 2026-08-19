FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./

RUN pnpm install

COPY . .

RUN pnpm prisma:generate
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

# Usa o binário do Prisma direto do node_modules em vez de `pnpm exec`: em
# produção não precisamos do corepack/pnpm dentro do container, só do CLI
# já instalado como devDependency na etapa de build.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
