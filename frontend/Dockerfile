# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: production image (nginx) ────────────────────────────────────────
FROM nginx:1.27-alpine

# Patch OS packages
RUN apk upgrade --no-cache --allow-untrusted || true

# Serve built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config — uses ppai-backend as the backend service name (docker compose)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run nginx as non-root (port 8080 instead of 80)
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
