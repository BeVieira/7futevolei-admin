FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./

RUN pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host"]
