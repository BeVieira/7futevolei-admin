FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./

RUN pnpm install

COPY . .

RUN pnpm prisma:generate

EXPOSE 3333

CMD ["pnpm", "dev"]
