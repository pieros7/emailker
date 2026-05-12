# ── Etapa 1: instalar dependencias ──────────────────
FROM node:24-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Etapa 2: compilar y generar bundle estático ──────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Etapa 3: servidor estático (sin Node) ────────────
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
