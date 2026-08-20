FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./

RUN pnpm install

# Estágio de dev: usado pelo docker-compose (target: dev), com o código
# montado por volume por cima do que foi copiado aqui e hot-reload via Vite.
FROM base AS dev

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host"]

FROM base AS build

COPY . .

RUN pnpm build

FROM nginx:1.27-alpine AS prod

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
