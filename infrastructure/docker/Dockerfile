# Self-contained frontend build; no backend sources required.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/home-model/package.json ./packages/home-model/package.json
COPY packages/device-model/package.json ./packages/device-model/package.json
COPY packages/geometry-engine/package.json ./packages/geometry-engine/package.json
COPY packages/floorplan-engine/package.json ./packages/floorplan-engine/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
FROM nginx:stable-alpine
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
EXPOSE 80
