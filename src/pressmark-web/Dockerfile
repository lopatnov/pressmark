FROM node:25-alpine AS build
WORKDIR /app
COPY src/pressmark-web/package.json src/pressmark-web/package-lock.json ./
RUN npm ci
COPY src/pressmark-web/ .
RUN npm run build

FROM nginx:1.29-alpine
RUN apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
