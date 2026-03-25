# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Regenerate Prisma client (generated/ is git-ignored)
RUN npx prisma generate
# Compile TypeScript via NestJS CLI
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Copy all node_modules from builder (includes CLI tools such as prisma, tsx)
COPY --from=builder /app/node_modules ./node_modules
# Compiled application
COPY --from=builder /app/dist ./dist
# Generated Prisma client (referenced by dist at runtime)
COPY --from=builder /app/generated ./generated
# Migrations and Prisma CLI config
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

# Uploads directory for user-submitted images
RUN mkdir -p uploads

EXPOSE 3001

# Apply pending migrations then start the server.
# Seed is intentionally NOT run automatically — use:
#   docker compose exec backend npx prisma db seed
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
