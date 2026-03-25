# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Production (served by nginx) ───────────────────────────────────
FROM nginx:alpine

# Copy the Vite production build
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default nginx config with our reverse-proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
