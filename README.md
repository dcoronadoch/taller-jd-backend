# Taller y Repuestos JD - Backend

API REST (Node.js + Express + TypeScript + MySQL) del sistema Taller y Repuestos JD.

**Fase actual:** autenticación, usuarios, roles y el módulo de **repuestos** (con marcas, categorías e imágenes). Los demás módulos de negocio se agregan después siguiendo la misma estructura.

## Requisitos

- Node.js 20 o superior
- MySQL 8 con la base `dbtallerjd` (tablas `roles`, `users`, `brands`, `categories`, `parts` y `part_images`) y al menos un usuario ADMIN creado con el Setup

## Configuración

1. Copie `.env.example` a `.env`.
2. Complete `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`.
3. Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

El `.env` no se sube a Git (está en `.gitignore`).

## Ejecutar

```bash
npm install
npm run dev        # desarrollo, con recarga automática
npm run build      # compila a dist/
npm start          # ejecuta dist/server.js
npm run typecheck  # revisa tipos sin compilar
```

API local: http://localhost:3000

## Estructura

```
src/
├── config/
│   ├── env.ts          Lee y valida el .env
│   └── database.ts     Pool de conexiones MySQL
├── middlewares/
│   └── auth.middleware.ts   JWT y control por rol (requireRoles / requireAdmin / requireStaff)
├── routes/             Define las URLs y qué middleware usa cada una
├── controllers/        Valida la solicitud y arma la respuesta HTTP
├── services/           Lógica de negocio y consultas SQL
├── utils/
│   ├── http-error.ts   Error con código HTTP
│   ├── validators.ts   Validaciones reutilizables (IDs, texto, precio, stock, URL, paginación)
│   └── send-error.ts   Convierte errores en respuestas HTTP sin exponer detalles internos
├── types/express.d.ts  Agrega req.authUser a Express
└── server.ts           Arranque de la aplicación
```

Flujo de una solicitud: `route → middleware → controller → service → MySQL`.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/` | Público | Estado de la API |
| GET | `/api/test-db` | Público | Prueba la conexión con MySQL |
| POST | `/api/auth/login` | Público | Inicia sesión y devuelve el token |
| GET | `/api/roles` | ADMIN | Todos los roles |
| GET | `/api/users/roles` | ADMIN | Roles disponibles para crear cuentas (ADMIN y EMPLOYEE) |
| GET | `/api/users?page=1&limit=10&search=` | ADMIN | Lista paginada de usuarios |
| POST | `/api/users` | ADMIN | Crea un usuario |
| PUT | `/api/users/:id` | ADMIN | Edita correo, rol, estado y (opcional) contraseña |
| PATCH | `/api/users/:id/status` | ADMIN | Activa o desactiva (`{ "status": 0 }` o `1`) |

### Repuestos, marcas y categorías

Todas estas rutas requieren token de **ADMIN o EMPLOYEE**. El `DELETE` no borra filas: desactiva el registro (`status = 0`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/parts?page=1&limit=10&search=&brand_id=&category_id=&status=` | Lista paginada con marca, categoría e imagen principal |
| GET | `/api/parts/:id` | Un repuesto con todas sus imágenes |
| POST | `/api/parts` | Crea un repuesto |
| PUT | `/api/parts/:id` | Reemplaza los datos del repuesto (se envían todos los campos) |
| PATCH | `/api/parts/:id/status` | Activa o desactiva (`{ "status": 0 }` o `1`) |
| DELETE | `/api/parts/:id` | Desactiva el repuesto |
| POST | `/api/parts/:id/images` | Agrega una imagen por URL (`url`, `is_primary`, `sort_order`) |
| PATCH | `/api/parts/:id/images/:imageId` | Cambia la imagen principal o el orden |
| DELETE | `/api/parts/:id/images/:imageId` | Elimina una imagen |
| GET | `/api/brands?status=1` | Lista de marcas |
| GET | `/api/brands/:id` | Una marca |
| POST | `/api/brands` | Crea una marca (`name`) |
| PUT | `/api/brands/:id` | Edita nombre y estado |
| PATCH | `/api/brands/:id/status` | Activa o desactiva |
| DELETE | `/api/brands/:id` | Desactiva la marca |
| GET | `/api/categories?status=1` | Lista de categorías |
| GET | `/api/categories/:id` | Una categoría |
| POST | `/api/categories` | Crea una categoría (`name`, `description`) |
| PUT | `/api/categories/:id` | Edita nombre, descripción y estado |
| PATCH | `/api/categories/:id/status` | Activa o desactiva |
| DELETE | `/api/categories/:id` | Desactiva la categoría |

Cuerpo de `POST /api/parts` y `PUT /api/parts/:id`:

```json
{
  "sku": "FR-001",
  "name": "Pastillas de freno delanteras",
  "description": "Opcional",
  "price": 27000.50,
  "stock": 8,
  "brand_id": 1,
  "category_id": 1,
  "status": 1
}
```

Respuestas: `200` éxito, `201` creado (devuelve `id`), `400` dato inválido o referencia inexistente/inactiva, `401` sin token o token inválido, `403` rol sin permiso, `404` no encontrado, `409` duplicado o regla de negocio.

### Catálogo público (Front Office)

Rutas **sin token** y de **solo lectura**. Solo devuelven repuestos activos cuya marca y categoría también están activas; no exponen el estado, las fechas ni la cantidad exacta de inventario (solo `available`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/catalog/parts` | Lista de repuestos publicados (`id`, `sku`, `name`, `description`, `price`, `available`, `brand`, `category`, `image_url`) |
| GET | `/api/catalog/parts/:id` | Un repuesto publicado con su lista de imágenes; `404` si no existe o no está publicado |

Para que el Front Office pueda consultarlas, su origen debe estar en `FRONTEND_URLS` (por ejemplo `http://localhost:5173,http://localhost:5174`).

Las rutas protegidas requieren el encabezado `Authorization: Bearer <token>`. El token dura 2 horas.

### Prueba rápida

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tallerjd.com","password":"su-contraseña"}'

# 2. Listar usuarios (use el token recibido)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer EL_TOKEN"

# 3. Crear un empleado
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer EL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"empleado@tallerjd.com","password":"clave12345","role_id":2}'
```

## Reglas de seguridad incluidas

- Contraseñas con bcrypt; el login responde igual si el correo no existe o la clave es incorrecta.
- Solo un ADMIN puede gestionar usuarios.
- Nadie puede desactivarse ni cambiarse el rol a sí mismo.
- Siempre debe quedar al menos un ADMIN activo.
- Desde el Backoffice solo se crean cuentas ADMIN y EMPLOYEE (los clientes se registran desde el sitio público).
- CORS limitado a los orígenes de `FRONTEND_URLS`.

## Validaciones del módulo de repuestos

| Campo / proceso | Validación | Respuesta |
|---|---|---|
| `sku` | Obligatorio, máx. 40, solo letras, números, `.`, `-`, `_` (se guarda en mayúsculas); único | 400 / 409 |
| `name` | Obligatorio, máx. 150 caracteres | 400 |
| `price` | Número mayor que 0, máx. 2 decimales | 400 |
| `stock` | Entero mayor o igual a 0 | 400 |
| `brand_id`, `category_id` | Deben existir y estar activas | 400 |
| Marca o categoría a desactivar | No puede tener repuestos activos | 409 |
| Activar un repuesto | Su marca y categoría deben estar activas | 400 |
| Imágenes | URL `http(s)`, máximo 10 por repuesto; la primera queda como principal | 400 / 409 |
| `:id` | Entero positivo; si no existe, 404 | 400 / 404 |
| Consultas SQL | Todas parametrizadas | — |
