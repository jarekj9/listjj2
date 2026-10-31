FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/40-listjj-config.sh /docker-entrypoint.d/40-listjj-config.sh
COPY docker/45-nginx-config.sh /docker-entrypoint.d/45-nginx-config.sh
RUN chmod +x /docker-entrypoint.d/40-listjj-config.sh /docker-entrypoint.d/45-nginx-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
