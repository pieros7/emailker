# Plan de Autenticación — Core (NestJS)

> **Principio guía**: un solo token JWT sin expiración, en cookie `HttpOnly`. Sin refresh, sin rotación, sin estado de sesión en BD. Logout = borrar la cookie.

---

## Estrategia de sesión

```/dev/null/session-strategy.txt#L1-15
┌──────────────────────────────────────────────────────┐
│  Login exitoso                                       │
│                                                      │
│  Core firma un JWT con JWT_SECRET                    │
│  → sin expiración (exp omitido)                      │
│  → payload: { sub: userId, email }                   │
│                                                      │
│  Set-Cookie: token=<jwt>; HttpOnly; SameSite=Strict  │
│                                                      │
│  Cada request autenticado:                           │
│  Cookie viaja automáticamente → JwtStrategy la lee   │
│  → req.user = { id, email }                          │
│                                                      │
│  Logout: Set-Cookie token=; Max-Age=0                │
└──────────────────────────────────────────────────────┘
```

| Decisión | Razón |
|---|---|
| **Cookie `HttpOnly`** | JavaScript no puede leerla → XSS safe |
| **`SameSite=Strict`** | El browser no la envía en requests cross-site → CSRF safe |
| **Sin `expiresIn`** | El JWT es válido indefinidamente hasta que se borra la cookie |
| **Sin tabla de sesiones** | El servidor es completamente stateless — no hay DB lookup por token |
| **Logout solo limpia la cookie** | No hay nada que invalidar en servidor. Trade-off asumido por simplicidad |

---

## Estructura de carpetas (Core)

```/dev/null/folder-structure.txt#L1-38
core/src/
├── main.ts                            # bootstrap: cookie-parser, ValidationPipe, CORS
├── app.module.ts                      # importa AuthModule, UsersModule, TypeOrmModule
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts             # POST /auth/register  /auth/login  /auth/logout  GET /auth/me
│   ├── auth.service.ts                # lógica: hash, compare, sign
│   ├── dto/
│   │   ├── register.dto.ts            # { email, password }
│   │   └── login.dto.ts               # { email, password }
│   ├── strategies/
│   │   └── jwt.strategy.ts            # lee el JWT de la cookie, devuelve req.user
│   └── guards/
│       ├── jwt-auth.guard.ts          # extiende AuthGuard('jwt') — requiere sesión activa
│       └── admin.guard.ts             # ⚠ placeholder — requiere roleId de admin (pendiente roles)
│
└── users/
    ├── users.module.ts
    ├── users.controller.ts            # POST /users  (solo admin)
    ├── users.service.ts               # findByEmail, findById, create
    ├── users.entity.ts                # tabla "users" en PostgreSQL
    └── dto/
        ├── create-user.dto.ts         # { email, password, roleId }
        └── user-response.dto.ts       # excluye passwordHash de las respuestas
```

---

## Dependencias

```/dev/null/install.sh#L1-8
# Runtime
npm install @nestjs/jwt @nestjs/passport passport passport-jwt \
            @nestjs/typeorm typeorm pg \
            bcrypt cookie-parser class-validator class-transformer

# Dev / tipos
npm install -D @types/passport-jwt @types/bcrypt @types/cookie-parser
```

---

## Entidad `User`

```/dev/null/users.entity.ts#L1-30
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;              // bcrypt, nunca texto plano

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;             // FK a roles (funcionalidad pendiente)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;            // soft delete — null = activo, fecha = eliminado
}
```

> `@DeleteDateColumn` es nativo de TypeORM. Al usar `softRemove()` o `softDelete()`, rellena `deletedAt` automáticamente y excluye esos registros de todas las queries normales.

---

## API Endpoints

Prefijo global `/api` (el Gateway ya enruta `/api/` → Core).

| Método | Ruta | Guards | Quién puede | Descripción |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | — | público | Auto-registro sin rol asignado |
| `POST` | `/api/auth/login` | — | público | Valida credenciales, emite cookie con JWT |
| `POST` | `/api/auth/logout` | `JwtAuthGuard` | usuario autenticado | Borra la cookie |
| `GET` | `/api/auth/me` | `JwtAuthGuard` | usuario autenticado | Datos del usuario de la sesión |
| `POST` | `/api/users` | `JwtAuthGuard` + `AdminGuard` | solo admin | Crea un usuario con rol asignado |

### Esquemas de request/response

```/dev/null/api-schemas.ts#L1-52
// POST /api/auth/register
body:    { email: string; password: string }   // password: mín. 8 chars
res 201: { id: string; email: string; createdAt: string }
res 400: errores de validación del DTO
res 409: { message: "Email already registered" }

// POST /api/auth/login
body:    { email: string; password: string }
res 200: { id: string; email: string }
         Set-Cookie: token=<jwt>; HttpOnly; SameSite=Strict; Path=/
res 401: { message: "Invalid credentials" }
         // misma respuesta si el email no existe o la contraseña es incorrecta

// POST /api/auth/logout
Cookie:  token=<jwt>   (automático)
res 200: { message: "Logged out" }
         Set-Cookie: token=; Max-Age=0; Path=/

// GET /api/auth/me
Cookie:  token=<jwt>   (automático)
res 200: { id: string; email: string; roleId: string | null; createdAt: string }
res 401: cookie ausente o JWT corrupto

// POST /api/users   ← solo admin
Cookie:  token=<jwt>   (automático)
body:    { email: string; password: string; roleId: string }
res 201: { id: string; email: string; roleId: string; createdAt: string }
res 400: errores de validación del DTO
res 401: sin sesión activa
res 403: sesión activa pero el usuario no es admin
res 409: { message: "Email already registered" }
```

---

## Flujo detallado

```/dev/null/flows.txt#L1-45
── REGISTRO (público) ────────────────────────────────────────
1. POST /api/auth/register  { email, password }
2. ValidationPipe valida RegisterDto
3. UsersService.findByEmail(email)  → si existe → 409
4. bcrypt.hash(password, 12)
5. UsersService.create({ email, passwordHash, roleId: null })
6. Responde 201 con datos públicos

── LOGIN ─────────────────────────────────────────────────────
1. POST /api/auth/login  { email, password }
2. UsersService.findByEmail(email)
3. Si no existe → bcrypt.compare con hash ficticio (tiempo constante) → 401
4. bcrypt.compare(password, user.passwordHash)  → si falla → 401
5. jwtService.sign({ sub: user.id, email: user.email })  ← sin expiresIn
6. res.cookie('token', jwt, { httpOnly: true, sameSite: 'strict' })
7. Responde 200 con datos públicos del usuario

── REQUEST AUTENTICADO ───────────────────────────────────────
1. Cookie 'token' viaja automáticamente
2. JwtStrategy extrae y verifica el JWT con JWT_SECRET
3. validate({ sub, email }) → retorna { id, email }
4. req.user disponible en el controller

── CREAR USUARIO COMO ADMIN ──────────────────────────────────
1. POST /api/users  { email, password, roleId }
2. JwtAuthGuard verifica la cookie → req.user disponible
3. AdminGuard verifica que req.user tiene rol admin ⚠ placeholder
4. ValidationPipe valida CreateUserDto
5. UsersService.findByEmail(email)  → si existe → 409
6. bcrypt.hash(password, 12)
7. UsersService.create({ email, passwordHash, roleId })
8. Responde 201 con datos públicos del usuario creado

── LOGOUT ────────────────────────────────────────────────────
1. POST /api/auth/logout  (JwtAuthGuard verifica la cookie)
2. res.clearCookie('token', { path: '/' })
3. Responde 200 — el JWT sigue siendo técnicamente válido
   pero el browser ya no lo tiene → sesión efectivamente terminada
```

---

## `AdminGuard` — placeholder

```/dev/null/admin.guard.ts#L1-15
// ⚠ Placeholder — la lógica real depende de la implementación del módulo de roles.
// Por ahora rechaza cualquier acceso con 403 hasta que se complete.
// Cuando roles esté implementado: verificar que req.user.roleId
// corresponde al ID del rol "admin" (consulta a BD o comparación con env).

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // TODO: implementar cuando el módulo de roles esté disponible
    return false;   // bloquea todo hasta que se implemente
  }
}
```

---

## Variables de entorno

```/dev/null/.env.example#L1-14
# ── PostgreSQL ────────────────────────────────────
POSTGRES_USER=admin
POSTGRES_PASSWORD=cambia_esto_en_produccion
POSTGRES_DB=email_platform

# ── Servicio Core (NestJS) ────────────────────────
DATABASE_URL=postgresql://admin:cambia_esto_en_produccion@postgres:5432/email_platform
PORT=3001
NODE_ENV=production

# ── Auth ──────────────────────────────────────────
JWT_SECRET=un_secreto_muy_largo_y_aleatorio_minimo_32_chars
# Un solo secreto. Sin JWT_REFRESH_SECRET, sin TTLs.
```

---

## Consideraciones de seguridad

| Riesgo | Mitigación |
|---|---|
| **XSS roba el token** | Cookie `HttpOnly` — JS no puede accederla |
| **CSRF** | `SameSite=Strict` — el browser no envía la cookie en requests cross-site |
| **Contraseñas en BD** | `bcrypt` con cost factor 12 |
| **Enumeración de usuarios** | Login responde `401` genérico + `bcrypt.compare` contra hash ficticio para tiempo constante |
| **Escalada de privilegios en `POST /users`** | `AdminGuard` bloquea el acceso hasta que roles esté implementado |
| **Soft delete — datos visibles** | `@DeleteDateColumn` + TypeORM excluye automáticamente los registros con `deletedAt != null` de todas las queries |

---

## Orden de implementación

### Bloque 1 — Scaffolding y base de datos
1. Inicializar proyecto NestJS (`nest new . --skip-git --package-manager npm`)
2. Instalar dependencias
3. Configurar `TypeOrmModule.forRootAsync` con `DATABASE_URL` del `.env`
4. Crear `UsersModule`, entidad `User` con los cinco campos (`id`, `email`, `passwordHash`, `roleId`, `createdAt`, `updatedAt`, `deletedAt`), y `UsersService` (`findByEmail`, `findById`, `create`)

### Bloque 2 — Autenticación
5. Crear `AuthModule` + `AuthService`
6. Implementar `register()` — email único + hash + INSERT con `roleId: null`
7. Implementar `login()` — compare + `jwtService.sign` sin `expiresIn` + `res.cookie`
8. Implementar `logout()` — `res.clearCookie`
9. Implementar `JwtStrategy` — extrae JWT de `req.cookies['token']`
10. Crear `JwtAuthGuard` y `AdminGuard` (placeholder)
11. Crear `AuthController` con los 4 endpoints de auth

### Bloque 3 — Endpoint de administración
12. Crear `UsersController` con `POST /users` protegido por `JwtAuthGuard + AdminGuard`
13. Crear `CreateUserDto` con `{ email, password, roleId }` y sus validaciones

### Bloque 4 — Bootstrap y verificación
14. Configurar `main.ts` — `cookie-parser`, `ValidationPipe` global, prefijo `/api`, CORS con `credentials: true`
15. Levantar el stack con `docker compose up`
16. Probar los 5 endpoints con curl o Postman

---
