# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# nginx:alpine автоматически прогоняет envsubst по файлам в /etc/nginx/templates/
# и кладёт результат в /etc/nginx/conf.d/
# NGINX_ENVSUBST_FILTER ограничивает подстановку только нашими переменными,
# чтобы не затереть $http_upgrade, $host и прочие nginx-переменные
ENV NGINX_ENVSUBST_FILTER=AUTH
