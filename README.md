# Product Identity Platform - Starter v1

Repositorio base para el producto separado de Inmovar corporate.

## Decision tomada
- **Inmovar** queda como empresa madre / corporate.
- **Este repo** es el producto: NFC Authentication + Digital Product Identity.
- **Brand final y dominio** quedan configurables. No quedan hardcodeados en la app.

## Lo que resuelve esta version
- Landing publica para clientes, inversores y resellers.
- Dashboard multi-tenant con shells para roles.
- API backend separada con validacion SUN / SDM y admin endpoints.
- Estructura profesional para crecer sin romper el repo de Inmovar.

## Arquitectura
```txt
apps/
  web/        Landing publica y pricing
  dashboard/  Panel multi-tenant
  api/        NFC gateway + admin routes
packages/
  ui/         Componentes compartidos
  config/     Branding, pricing, roles, casos de uso
  core/       Tipos y helpers comunes
```

## Stack
- Next.js App Router
- TypeScript
- npm workspaces
- Neon Postgres
- Tailwind CSS
- Recharts
- Framer Motion
- Zod

## Decision importante
Para **v1** se mantiene **Neon + SQL directo** en `apps/api`.
No meti Prisma todavia porque hoy suma friccion y no te da una ventaja real sobre lo que ya esta armado en el starter. Cuando el esquema se estabilice, se puede migrar.

## Pricing model fijado para la app
Atencion: si queres que **10.000 botellas = USD 200**, el valor correcto es **USD 0.02 por botella**, no "0.02 cent".

## Paso a paso de arranque
### 1. Crear repo nuevo
Nombre interno sugerido:
- `product-identity-platform`
- o `nfc-gateway-platform`

No usar el repo actual de Inmovar corporate.

### 2. Instalar dependencias
```bash
npm install
```

### 3. Crear los 3 proyectos en Vercel
- `apps/web`
- `apps/dashboard`
- `apps/api`

Vercel soporta monorepos y permite crear un proyecto por directorio del repo. Ver docs oficiales.

### 4. Crear base Neon
- Crear DB
- Copiar `DATABASE_URL`
- Ejecutar:
```bash
psql "$DATABASE_URL" -f apps/api/db/schema.sql
```

### 5. Variables de entorno
#### apps/api
```env
DATABASE_URL=
ADMIN_API_KEY=
KMS_MASTER_KEY_HEX=
NEXT_PUBLIC_PRODUCT_NAME=Product Identity Cloud
NEXT_PUBLIC_PARENT_BRAND=Inmovar
NEXT_PUBLIC_APP_URL=https://dashboard.tudominio.com
```

#### apps/web
```env
NEXT_PUBLIC_PRODUCT_NAME=Product Identity Cloud
NEXT_PUBLIC_PARENT_BRAND=Inmovar
NEXT_PUBLIC_API_BASE_URL=https://api.tudominio.com
```

#### apps/dashboard
```env
NEXT_PUBLIC_PRODUCT_NAME=Product Identity Cloud
NEXT_PUBLIC_PARENT_BRAND=Inmovar
NEXT_PUBLIC_API_BASE_URL=https://api.tudominio.com
```

### 6. Desarrollo local
```bash
npm run dev:web
npm run dev:dashboard
npm run dev:api
```

### 7. Primer smoke test
```bash
curl http://localhost:3003/health/
```

### 8. Primeros objetivos de implementacion real
1. Subir repo
2. Deploy de `apps/api`
3. Dominio API
4. Crear tenant demo
5. Crear batch demo
6. Importar manifest de muestras
7. Activar tags demo
8. Probar taps reales

## Rutas clave
### Web
- `/`
- `/pricing`
- `/resellers`
- `/docs`

### Dashboard
- `/`
- `/batches`
- `/events`
- `/resellers`
- `/billing`
- `/login`
- `/register`

### API
- `/health/`
- `/sun/`
- `/admin/tenants/`
- `/admin/batches/`
- `/admin/batches/:bid/import-manifest/`
- `/admin/tags/activate/`
- `/admin/batches/:bid/revoke/`

## Visual direction
Tomar la linea del demo actual:
- fondo oscuro
- cyan / cobalt
- glass cards
- terminal / live metrics
- narrativa B2B + antifraude + producto premium

## Que NO hacer
- No mezclar esto con `inmovar.com.ar`
- No hardcodear el brand final en componentes o rutas
- No hacer pricing ambiguo con "0.02 cent"
- No prometer tokenizacion como core si todavia no existe el flujo real

## Fases recomendadas
### Fase 1
- API viva
- landing productiva
- dashboard shell

### Fase 2
- auth real
- roles reales
- manifest + activacion
- scans reales

### Fase 3
- billing
- reseller portal
- tokenization module



## Vercel deployment (important)

This repository is a **monorepo**. Do **not** deploy the whole repo as one generic Next app.
Create a separate Vercel project for each app and set the **Root Directory** accordingly:

- `apps/api` → API project
- `apps/web` → public landing
- `apps/dashboard` → internal dashboard

If you only want to start with the backend, create **one Vercel project** and set:

- **Framework Preset**: Next.js
- **Root Directory**: `apps/api`

Then add environment variables to that project:

- `DATABASE_URL`
- `ADMIN_API_KEY`
- `KMS_MASTER_KEY_HEX`

For the custom domain, attach `api.inmov.ar` to the **apps/api** project only.


## Required env vars before deploying `apps/api`

Set these in Vercel **before** the first build of the API project:

- `DATABASE_URL`
- `ADMIN_API_KEY`
- `KMS_MASTER_KEY_HEX`

If `DATABASE_URL` is missing, runtime requests will fail.
