# Emailker

Plataforma web para la gestión y creación de correos electrónicos. Permite a los usuarios redactar, organizar y administrar sus comunicaciones por correo desde una interfaz moderna y fluida, respaldada por una API segura con autenticación JWT y almacenamiento persistente en base de datos.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React · TypeScript · Vite |
| Backend | NestJS · TypeScript · JWT |
| Base de datos | PostgreSQL 16 |
| API Gateway | Nginx 1.25 |
| Contenerización | Docker · Docker Compose |
| Runtime | Node.js 24 LTS |

---

## Arquitectura

El sistema está compuesto por cuatro servicios orquestados con Docker Compose y comunicados a través de una red interna (`email_net`). El único punto de entrada público es el **API Gateway**; el resto de los servicios permanece aislado y no es accesible desde el exterior.

```
Browser
  │
  ▼
API Gateway (Nginx · :80)  ← único puerto expuesto al host
  │
  ├── /        → Frontend (React SPA · Nginx · :3000)
  └── /api/    → Core (NestJS · :3001)
                    │
                    └── PostgreSQL (:5432)
```

El **Frontend** es una Single Page Application: el servidor solo entrega los archivos estáticos (`index.html`, JS, CSS) en la primera visita. A partir de ahí, React corre en el navegador y se comunica directamente con el **Core** a través del Gateway en la ruta `/api/`. El contenedor Frontend no vuelve a participar en ese flujo.

El **Core** es la API REST construida con NestJS. Gestiona la lógica de negocio, la autenticación con JWT y todas las operaciones sobre la base de datos a través de PostgreSQL.

---

## Estructura del proyecto

```
emailker/
├── docker-compose.yml               # Orquestación de producción
├── docker-compose.override.yml      # Overrides para desarrollo local
├── .env                             # Variables de entorno (no se versiona)
├── .env.example                     # Plantilla de variables para el equipo
├── .gitignore
│
├── gateway/
│   └── nginx.conf                   # Configuración del API Gateway
│
├── frontend/
│   ├── Dockerfile                   # Build multistage: builder + Nginx runner
│   ├── nginx-spa.conf               # Config interna del contenedor SPA
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── core/
    ├── Dockerfile                   # Build multistage: deps, builder y runner
    ├── src/
    ├── package.json
    └── tsconfig.json
```

---

## Primeros pasos

### Requisitos previos

- [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/) instalados.

### Configuración del entorno
crear el .env

```sh
# levantar db
sudo docker compose -f docker-compose.db-core.yml up -d

# levantar Backend core
cd core/
npm run start:dev

# levantar Frontend
cd ../frontend/
npm run dev

# eliminar db
sudo docker compose down
```

Las variables disponibles se encuentran documentadas en `.env.example`. Como mínimo, es necesario definir las credenciales de PostgreSQL, la `DATABASE_URL` del Core y el `JWT_SECRET`.

---

## Uso

### Desarrollo local

Docker Compose aplica `docker-compose.override.yml` automáticamente junto al archivo principal. Esto habilita hot-reload en Frontend y Core, y expone PostgreSQL al host para conectarse con herramientas como DBeaver o TablePlus.

```sh
# Construir imágenes (solo la primera vez o tras cambios en dependencias)
docker compose build --no-cache

# Levantar el stack completo
docker compose up

# Ver logs de un servicio en tiempo real
docker compose logs -f core
docker compose logs -f frontend
```

La aplicación estará disponible en [http://localhost](http://localhost).

### Producción

```sh
# Levantar usando únicamente la configuración de producción
docker compose -f docker-compose.yml up -d

# Verificar el estado de los contenedores
docker compose ps
```

### Operaciones frecuentes

```sh
# Reconstruir y reiniciar un único servicio sin afectar los demás
docker compose build core
docker compose up -d --no-deps core

# Detener el stack preservando los datos
docker compose down

# Detener el stack y eliminar la base de datos (⚠ irreversible)
docker compose down -v

# Limpiar imágenes huérfanas
docker image prune -f
```

---

## Variables de entorno

Todas las variables están definidas en `.env.example`. Nunca se debe versionar el archivo `.env`.

| Variable | Descripción |
|---|---|
| `POSTGRES_USER` | Usuario de la base de datos |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos |
| `POSTGRES_DB` | Nombre de la base de datos |
| `DATABASE_URL` | Cadena de conexión completa para el Core |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT (mínimo 32 caracteres) |
| `PORT` | Puerto interno del servicio Core (por defecto `3001`) |
| `NODE_ENV` | Entorno de ejecución (`production` / `development`) |
| `VITE_API_BASE_URL` | Ruta base de la API consumida por el Frontend (por defecto `/api`) |

---

## Decisiones de diseño destacadas

- **Build multistage** en Frontend y Core — las imágenes finales no contienen código fuente TypeScript, devDependencies ni utilidades de compilación, lo que reduce el tamaño y la superficie de ataque.
- **Etapa `prod-deps` separada** en Core — garantiza que paquetes como `typescript` o `@types/*` no lleguen a producción.
- **Solo el Gateway publica puertos** al host — Core y PostgreSQL son inaccesibles desde el exterior; toda la comunicación pasa por Nginx.
- **`condition: service_healthy`** en Core — el servicio espera a que PostgreSQL responda correctamente antes de iniciar, evitando errores de conexión en el arranque.
- **Usuario no root** en Core — el proceso NestJS corre bajo un usuario sin privilegios dentro del contenedor.
- **`docker-compose.override.yml`** para desarrollo — hot-reload y exposición de puertos adicionales sin contaminar la configuración de producción.
