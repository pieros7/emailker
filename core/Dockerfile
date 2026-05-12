# ── Etapa 1: dependencias completas (para compilar) ──
FROM node:24-alpine AS all-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Etapa 2: dependencias solo de producción ─────────
FROM node:24-alpine AS prod-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Etapa 3: compilar TypeScript ─────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=all-deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Etapa 4: imagen de producción ────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules  # <-- prod-deps, no all-deps
COPY package*.json ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001
CMD ["node", "dist/main.js"]
