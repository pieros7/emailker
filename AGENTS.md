# Sistema de plataforma de gestión y creación de correos electrónicos
# Plan de contenedorización Docker
### Servicios: Frontend · API Gateway · Core
> Stack: React + NestJS + Nginx + PostgreSQL — Node.js 24 LTS

---

## Arquitectura de contenedores

```
                        ┌─────────────────────────────────────────────────────┐
                        │              Docker host (Ubuntu)                    │
                        │                                                      │
                        │   ┌──────────────────────────────────────────────┐  │
                        │   │          bridge network: email_net            │  │
                        │   │                                               │  │
  Browser/Cliente       │   │   ┌─────────────────────────────────────┐    │  │
  (Fase 1: pide app) ───┼───┼──►│         API Gateway (Nginx)         │    │  │
  (Fase 2: llama API)   │   │   │         puerto 80 expuesto          │    │  │
                        │   │   └────────────┬──────────────┬──────────┘    │  │
                        │   │                │              │                │  │
                        │   │           /  proxy      /api/ proxy            │  │
                        │   │                │              │                │  │
                        │   │   ┌────────────▼──┐  ┌───────▼───────────┐   │  │
                        │   │   │   Frontend    │  │   Servicio Core   │   │  │
                        │   │   │  React · SPA  │  │  NestJS · :3001   │   │  │
                        │   │   │  Nginx · :3000│  │  TypeScript · JWT │   │  │
                        │   │   └───────────────┘  └────────┬──────────┘   │  │
                        │   │                               │               │  │
                        │   │                          :5432│               │  │
                        │   │                    ┌──────────▼──────────┐   │  │
                        │   │                    │    PostgreSQL 16     │   │  │
                        │   │                    │  volumen persistente │   │  │
                        │   │                    └─────────────────────┘   │  │
                        │   └──────────────────────────────────────────────┘  │
                        └─────────────────────────────────────────────────────┘
```

### Flujo de comunicación

El Frontend es una SPA: el contenedor solo sirve archivos estáticos (HTML, JS, CSS).
Una vez que el browser descarga esos archivos, React corre en el cliente y hace
llamadas directamente al API Gateway. El contenedor Frontend no vuelve a participar.

- **Fase 1** — Browser → Gateway → contenedor Frontend → devuelve `index.html` + `bundle.js`
- **Fase 2** — React (en el browser) → Gateway `/api/...` → Servicio Core → responde JSON

Solo el **API Gateway** expone un puerto al host. El resto se comunica por red interna.

---

## Estructura de carpetas

```
emailker/
├── docker-compose.yml               # orquestación de producción
├── docker-compose.override.yml      # overrides para desarrollo local
├── .env                             # variables de entorno (nunca en git)
├── .env.example                     # plantilla para el equipo
├── .gitignore
│
├── gateway/
│   └── nginx.conf                   # config del API Gateway
│
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx-spa.conf               # config interna del contenedor SPA
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── core/
    ├── Dockerfile
    ├── .dockerignore
    ├── src/
    ├── package.json
    └── tsconfig.json
```

---

## Variables de entorno

### `.env.example`

```env
# ── PostgreSQL ───────────────────────────────────────
POSTGRES_USER=admin
POSTGRES_PASSWORD=cambia_esto_en_produccion
POSTGRES_DB=email_platform

# ── Servicio Core (NestJS) ───────────────────────────
# "postgres" es el nombre del contenedor dentro de la red Docker, no localhost
DATABASE_URL=postgresql://admin:cambia_esto_en_produccion@postgres:5432/email_platform
JWT_SECRET=un_secreto_muy_largo_y_aleatorio_minimo_32_chars
PORT=3001
NODE_ENV=production

# ── Frontend ─────────────────────────────────────────
# Ruta relativa: funciona igual en local y producción sin cambiar nada.
# El Gateway ya enruta /api/ al Core. Vite la hornea en el bundle en build time.
VITE_API_BASE_URL=/api
```

> Copiar a `.env` y completar los valores reales. Agregar `.env` al `.gitignore`.

---

## Dockerfiles

### `frontend/Dockerfile`

Build multistage: la etapa `builder` compila TypeScript y genera el bundle estático.
La etapa `runner` usa Nginx Alpine solo para servir esos archivos — sin Node en producción.

```dockerfile
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

# Declarar el ARG con valor por defecto.
# Debe estar en esta etapa, antes del RUN npm run build,
# para que Vite lo encuentre en import.meta.env al compilar.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build
# Genera /app/dist con index.html, assets JS/CSS, etc.
# VITE_API_BASE_URL queda horneado en el bundle en este paso.

# ── Etapa 3: servidor estático (sin Node) ────────────
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

### `frontend/nginx-spa.conf`

Config interna del contenedor Frontend. Solo redirige 404 al `index.html` para que
React Router funcione correctamente en el cliente.

```nginx
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

### `frontend/.dockerignore`

```
node_modules/
dist/
.env*
*.md
.git/
coverage/
```

---

### `core/Dockerfile`

Build multistage con cuatro etapas. La clave está en separar las dependencias de
desarrollo (necesarias para compilar TypeScript) de las de producción (solo runtime).
La etapa `runner` copia `node_modules` desde `prod-deps`, no desde `all-deps`,
garantizando que ninguna devDependency llegue a la imagen final.

```dockerfile
# ── Etapa 1: dependencias completas (para compilar) ──
FROM node:24-alpine AS all-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci
# Instala TODO: devDependencies incluidas (typescript, @types/*, etc.)

# ── Etapa 2: dependencias solo de producción ─────────
FROM node:24-alpine AS prod-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
# Instala SOLO dependencies, excluye devDependencies

# ── Etapa 3: compilar TypeScript ─────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=all-deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
# Genera /app/dist con el JS compilado de NestJS

# ── Etapa 4: imagen de producción ────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules  # <-- prod-deps, no all-deps
COPY package*.json ./

# Crear usuario no root para correr el proceso
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### `core/.dockerignore`

```
node_modules/
dist/
.env*
*.md
.git/
test/
coverage/
```

---

## API Gateway

### `gateway/nginx.conf`

Punto de entrada único. Enruta `/api/` al Core y todo lo demás al Frontend.
Los nombres `frontend` y `core` coinciden con los nombres de servicio en docker-compose.

```nginx
upstream frontend {
    server frontend:3000;
}

upstream core {
    server core:3001;
}

server {
    listen 80;

    # ── Rutas de datos → Servicio Core ───────────────
    location /api/ {
        proxy_pass         http://core/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }

    # ── Todo lo demás → Frontend SPA ─────────────────
    location / {
        proxy_pass         http://frontend;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}
```

---

## Docker Compose

### `docker-compose.yml` — Producción

```yaml
services:

  gateway:
    image: nginx:1.25-alpine
    container_name: email_gateway
    ports:
      - "80:80"                         # único puerto expuesto al host
    volumes:
      - ./gateway/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - core
    networks:
      - email_net
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      target: runner                    # etapa final: Nginx + archivos estáticos
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/api}
        # Se pasa en build time para que Vite lo hornee en el bundle.
        # El valor por defecto /api funciona si la variable no está en .env.
    container_name: email_frontend
    expose:
      - "3000"                          # solo visible dentro de email_net
    # Sin env_file: el contenedor runner es Nginx puro,
    # no necesita variables de entorno en runtime.
    # Sin depends_on: Nginx sirve archivos estáticos y no tiene
    # ninguna dependencia de runtime con Core. Arrancan en paralelo.
    networks:
      - email_net
    restart: unless-stopped

  core:
    build:
      context: ./core
      target: runner                    # etapa final: Node 24 + JS compilado
    container_name: email_core
    expose:
      - "3001"                          # solo visible dentro de email_net
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy      # espera a que postgres esté listo
    networks:
      - email_net
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: email_postgres
    environment:
      POSTGRES_USER:     ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB:       ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    expose:
      - "5432"                          # solo visible dentro de email_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - email_net
    restart: unless-stopped

volumes:
  postgres_data:                        # volumen nombrado: persiste entre reinicios

networks:
  email_net:
    driver: bridge
```

---

### `docker-compose.override.yml` — Desarrollo local

Docker Compose aplica este archivo automáticamente cuando existe junto al principal.
Extiende la config de producción sin modificarla: agrega volúmenes para hot-reload,
habilita modo dev y expone postgres al host para usar herramientas como DBeaver o TablePlus.

```yaml
services:

  core:
    build:
      target: builder                   # etapa con devDependencies para ts-node/nodemon
    volumes:
      - ./core:/app                     # monta el código fuente para hot-reload
      - /app/node_modules               # preserva node_modules del contenedor
    command: npm run start:dev
    environment:
      NODE_ENV: development

  frontend:
    build:
      target: deps                      # solo node_modules, sin ejecutar npm run build
      # target: builder ejecutaría npm run build (compilación completa de Vite)
      # que se descarta inmediatamente porque el comando es npm run dev.
      # Con deps + volumen montado, Vite dev server tiene todo lo que necesita.
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/api}
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host 0.0.0.0 --port 3000
    # --port 3000 es obligatorio: el Gateway apunta a frontend:3000.
    # Sin esto Vite arranca en :5173 y el Gateway devuelve 502.
    environment:
      NODE_ENV: development
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/api}
      # En dev Vite sí lee variables de entorno del proceso en runtime,
      # por eso se define también aquí además del build arg.

  postgres:
    ports:
      - "5432:5432"                     # expone postgres al host solo en dev
```

---

## Comandos

### Primera vez / tras cambios en dependencias

```bash
# Copiar variables de entorno
cp .env.example .env
# Editar .env con los valores reales

# Construir todas las imágenes desde cero
docker compose build --no-cache
```

### Desarrollo local

```bash
# Levantar (usa docker-compose.yml + override automáticamente)
docker compose up

# En segundo plano
docker compose up -d

# Ver logs en tiempo real de un servicio
docker compose logs -f core
docker compose logs -f gateway
```

### Producción

```bash
# Levantar solo con el compose de producción (ignora el override)
docker compose -f docker-compose.yml up -d

# Verificar que los contenedores estén corriendo
docker compose ps
```

### Reconstruir un solo servicio

```bash
# Reconstruir imagen
docker compose build core

# Reiniciar sin afectar otros servicios
docker compose up -d --no-deps core
```

### Detener y limpiar

```bash
# Detener contenedores (preserva volúmenes y datos)
docker compose down

# Detener Y eliminar volúmenes (⚠ borra la base de datos)
docker compose down -v

# Limpiar imágenes huérfanas
docker image prune -f
```

---

## Decisiones clave

| Decisión | Razón |
|---|---|
| **Node 24 LTS** | Active LTS con soporte hasta abril 2028 |
| **Etapa `prod-deps` separada** en Core | `npm ci` instala todas las deps incluyendo devDependencies. Sin esta etapa, TypeScript, `@types/*` y demás se cuelan en producción |
| **Sin `depends_on: core`** en Frontend | Nginx sirve archivos estáticos y no llama a Core al arrancar. La dependencia real vive en el browser. Sin este `depends_on` Frontend y Core arrancan en paralelo, acelerando el inicio del stack |
| **`target: deps`** en override de Frontend | `target: builder` ejecuta `npm run build` completo que se descarta al instante porque el comando es `npm run dev`. Con `deps` + volumen montado el Vite dev server tiene todo lo que necesita sin el build innecesario |
| **`--port 3000`** en Vite dev | Vite arranca en `:5173` por defecto; el Gateway apunta a `frontend:3000`. Sin este flag el Gateway devuelve `502 Bad Gateway` en local |
| **Build multistage** en Frontend y Core | Imagen final sin `devDependencies` ni fuentes TypeScript; menor tamaño y superficie de ataque |
| **Solo `gateway` publica puertos** al host | El resto de servicios está aislado en la red interna; el exterior nunca accede directo a Core o Postgres |
| **`healthcheck` en PostgreSQL** | Evita que Core arranque antes de que la BD esté lista y acepte conexiones |
| **`postgres:16-alpine` y `nginx:1.25-alpine`** | Imágenes mínimas: menor tamaño, menos paquetes, menor superficie de ataque |
| **`USER appuser`** en Core | El proceso NestJS no corre como `root` dentro del contenedor |
| **`docker-compose.override.yml`** para dev | Hot-reload y postgres expuesto al host sin contaminar la config de producción |
| **`expose` vs `ports`** | `expose` hace el puerto visible solo en la red Docker; `ports` lo publica al host. Solo Gateway usa `ports` |
| **`condition: service_healthy`** en Core | Core espera el healthcheck real de Postgres, no solo que el contenedor esté "corriendo" |
