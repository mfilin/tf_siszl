FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY startup-banner.sh /docker-entrypoint.d/99-startup-banner.sh
RUN chmod +x /docker-entrypoint.d/99-startup-banner.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
