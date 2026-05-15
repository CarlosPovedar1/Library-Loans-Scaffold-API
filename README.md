# Library Loans API

Sistema de préstamos de biblioteca — examen parcial **ISIS 3710 — Programación con Tecnologías Web**.

## Arranque rápido

```bash
cp .env.example .env          # copiar variables de entorno
docker compose up -d          # levantar PostgreSQL
npm install                   # instalar dependencias
npm run migration:run         # crear tablas
npm run start:dev             # iniciar en modo desarrollo
```

Swagger UI disponible en [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta según tu entorno. Las siguientes son requeridas:

| Variable | Descripción | Default |
|---|---|---|
| `DB_HOST` | Host de PostgreSQL | — |
| `DB_PORT` | Puerto de PostgreSQL | — |
| `DB_USER` | Usuario de PostgreSQL | — |
| `DB_PASSWORD` | Contraseña de PostgreSQL | — |
| `DB_NAME` | Nombre de la base de datos | — |
| `JWT_ACCESS_SECRET` | Secret para tokens de acceso (≥ 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (≥ 32 chars) | — |
| `JWT_ACCESS_EXPIRES_IN` | Expiración del access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiración del refresh token | `7d` |
| `BCRYPT_SALT_ROUNDS` | Rondas de bcrypt | `10` |
| `MAX_ACTIVE_LOANS` | Préstamos activos máximos por miembro | `3` |
| `DAILY_FINE_RATE` | Multa diaria por atraso (en la unidad monetaria del sistema) | `0.50` |
| `MAX_LOAN_DAYS` | Días máximos de préstamo (informativo) | `30` |

Si falta alguna variable requerida o no cumple el formato, la app **falla al arrancar** con un mensaje descriptivo (validación Joi).

---

## Endpoints

### Auth — `/api/auth`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/register` | Público | Registra un usuario. Devuelve `{ accessToken, refreshToken, user }`. |
| POST | `/login` | Público | Autenticar. Devuelve `{ accessToken, refreshToken, user }`. |
| POST | `/refresh` | Público | Intercambia un refresh token válido por nuevos tokens (rotación). |
| POST | `/logout` | Público | Revoca un refresh token. |

### Items — `/api/items`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/` | Admin, Librarian | Crea un ítem. |
| GET | `/` | Todos | Lista ítems. Filtros: `type`, `status`, `search`. |
| GET | `/:id` | Todos | Obtiene un ítem por ID. |
| PATCH | `/:id` | Admin, Librarian | Actualiza un ítem. |
| DELETE | `/:id` | Admin, Librarian | Soft-delete (status = inactive). |

### Loans — `/api/loans`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/` | Todos | Crea un préstamo. `dueAt` requerido (ISO 8601, debe ser futuro). |
| GET | `/` | Todos | Lista préstamos. Miembros solo ven los suyos. Filtros: `status`, `overdue`, `memberId`, `itemId`. |
| GET | `/:id` | Todos | Obtiene préstamo. Miembros solo pueden ver el propio. |
| PATCH | `/:id/return` | Admin, Librarian | Registra devolución y calcula multa. |
| PATCH | `/:id/lost` | Admin, Librarian | Marca préstamo e ítem como perdidos. |

### Reservations — `/api/reservations`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/` | Todos | Reserva un ítem no disponible (cola FIFO). |
| GET | `/` | Todos | Lista reservas. Miembros solo ven las suyas. Filtros: `status`, `itemId`, `memberId`. |
| PATCH | `/expire-ready` | Admin, Librarian | Expira reservas READY vencidas y activa la siguiente en cola. |
| PATCH | `/:id/cancel` | Todos | Cancela una reserva. Miembros solo pueden cancelar las propias. |

---

## Reglas de negocio

### Roles

- **admin / librarian**: Gestión completa. Pueden crear préstamos y reservas en nombre de un miembro usando `memberId`.
- **member**: Solo puede actuar sobre sus propios recursos. No puede devolver préstamos ni expirar reservas.

### Estados del ítem

```
available ──(prestar)──→ borrowed ──(devolver)──→ available
                                   └──(devolver con cola)──→ reserved
available ──(cola activa)──→ reserved ──(miembro retira)──→ borrowed
borrowed/reserved ──(perder)──→ lost
```

### Préstamos

- `dueAt` lo especifica el cliente al crear el préstamo (debe ser un datetime futuro).
- `MAX_ACTIVE_LOANS` (env) préstamos activos máximos por miembro — error 409 si se supera.
- Un ítem `available` con reservas en cola no se puede tomar directamente: hay que reservar.
- Un ítem `reserved` solo puede ser tomado por el miembro cuya reserva está en `ready`.
- Multa = `ceil(días_de_atraso) × DAILY_FINE_RATE` (env).

### Reservas (cola FIFO)

- Solo se pueden reservar ítems en estado `borrowed` o `reserved`.
- Cola FIFO: la primera reserva en `pending` se activa (`ready`) cuando el ítem queda libre.
- `ready`: el miembro tiene **48 horas** para tomar el préstamo antes de que la reserva expire.
- Si una reserva `ready` se cancela o expira, se activa automáticamente la siguiente `pending`.
- Estados: `pending → ready → completed | cancelled | expired`.
- Timestamps de transición: `readyAt`, `completedAt`, `cancelledAt`, `expiredAt`.

### Refresh tokens

- Tokens de refresco persisten en BD con su `jti` (JWT ID).
- `/auth/refresh` rota el token: revoca el actual y emite uno nuevo.
- `/auth/logout` revoca el token sin emitir uno nuevo.

---

## Estructura del proyecto

```
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── configuration.ts          # Factory de AppConfig
│   └── validation.schema.ts      # Esquema Joi
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   └── guards/
│       └── roles.guard.ts
├── database/
│   ├── data-source.ts
│   └── migrations/
│       └── 1747180800000-InitialSchema.ts
└── modules/
    ├── auth/
    │   ├── dto/
    │   ├── entities/user.entity.ts
    │   ├── guards/jwt-auth.guard.ts
    │   ├── strategies/jwt.strategy.ts
    │   ├── auth.controller.ts
    │   ├── auth.module.ts
    │   └── auth.service.ts
    ├── health/
    ├── items/
    ├── loans/
    ├── refresh-tokens/
    │   ├── entities/refresh-token.entity.ts
    │   ├── refresh-tokens.module.ts
    │   └── refresh-tokens.service.ts
    └── reservations/
test/
    ├── app.e2e-spec.ts
    └── jest-e2e.json
.github/
    └── workflows/
        └── ci.yml
```

---

## Scripts

| Script | Descripción |
|---|---|
| `npm run start:dev` | Arranca con hot reload |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm run lint` | ESLint con autofix |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests de integración (requiere DB) |
| `npm run migration:run` | Aplica migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |

---

## Tests e2e

Los tests requieren una base de datos PostgreSQL activa. Con Docker Compose:

```bash
docker compose up -d
npm run migration:run
npm run test:e2e
```

Cubren:
- Registro, login, refresh y logout de autenticación
- CRUD de ítems con control de acceso por rol
- FSM de préstamos con matrix `it.each` (active → returned, active → lost)
- Cola FIFO de reservas: activación, cancelación en cascada, expiración
- Restricciones de negocio: MAX_ACTIVE_LOANS, dueAt futuro, 409 para conflictos
