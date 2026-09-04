FROM node:24-alpine AS build
WORKDIR /app
COPY src/pressmark-web/package.json src/pressmark-web/package-lock.json ./
RUN npm ci
COPY src/pressmark-web/ .
RUN npm run build

FROM nginx:1.31.4-alpine3.24-slim
RUN apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
