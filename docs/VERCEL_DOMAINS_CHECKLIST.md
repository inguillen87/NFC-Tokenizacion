# nexID Vercel Domain Checklist (manual)

Objetivo: eliminar loops y dejar routing limpio entre web/dashboard/api.

## 1) Proyecto `apps/web`
- **Production domain:** `nexid.lat`
- **Alias opcional:** `www.nexid.lat`
- Si usás `www`, mantenelo con redirect único hacia `https://nexid.lat`.
- En código ya hay middleware para canonicalizar `www.nexid.lat -> nexid.lat`.

## 2) Proyecto `apps/dashboard`
- **Production domain:** `app.nexid.lat`
- No agregar `nexid.lat` ni `www.nexid.lat` aquí.

## 3) Proyecto `apps/api`
- **Production domain:** `api.nexid.lat`
- No agregar `nexid.lat` ni `www.nexid.lat` aquí.

## 4) Variables de entorno

### apps/api
- `WEB_APP_URL=https://nexid.lat`
- `DATABASE_URL=<neon-url>`
- `POSTGRES_PRISMA_URL=<neon-prisma-url>` (si usás Prisma)
- `PUBLIC_CERTIFICATE_SIGNING_SECRET=<secret dedicado>`
- `SUN_HANDOFF_SECRET=<secret dedicado distinto>`
- `CLERK_SECRET_KEY=<server secret>`
- `CLERK_AUTHORIZED_PARTIES=https://app.nexid.lat,https://nexid.lat`

### apps/web
- `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`

### apps/dashboard
- `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`
- Variables Clerk del dashboard. La BFF reenvía la sesión opaca validada; no guarda una root key.

## 5) DNS (en tu proveedor de dominio)
- `nexid.lat` -> CNAME/Apex según guía Vercel al proyecto web.
- `www.nexid.lat` -> CNAME a Vercel (web).
- `app.nexid.lat` -> CNAME a Vercel (dashboard).
- `api.nexid.lat` -> CNAME a Vercel (api).

## 6) Verificación rápida
1. `https://nexid.lat` abre landing.
2. `https://www.nexid.lat` redirige una sola vez a `https://nexid.lat`.
3. `https://app.nexid.lat` abre dashboard.
4. `https://api.nexid.lat/health` responde JSON.
5. `https://api.nexid.lat` no debe provocar loop en browser.

## 7) Si sigue habiendo `ERR_TOO_MANY_REDIRECTS`
- Eliminar `www.nexid.lat` temporalmente del proyecto equivocado en Vercel.
- Confirmar que `nexid.lat` NO está en proyectos dashboard/api.
- Purgar cookies del dominio y probar en incógnito.

## 8) Caso real: hoy tenés **un solo proyecto** creado con Root Directory `apps/api`

Si tu primer proyecto quedó apuntando a `apps/api`, Vercel va a servir la API en `nexid.lat` y eso complica el split por subdominios.
No hace falta romper nada: podés migrar en pasos seguros.

### Fase A (sin romper lo existente)
1. Dejá el proyecto actual como está (Root Directory `apps/api`) hasta terminar la migración.
2. Verificá que `/health` siga funcionando y que la base de datos esté estable.
3. No borres variables de entorno aún.

### Fase B (crear proyectos nuevos en paralelo)
1. En Vercel, `Add New Project` (mismo repo) para:
   - `nexid-web` con Root Directory `apps/web`
   - `nexid-dashboard` con Root Directory `apps/dashboard`
2. Asigná primero dominios de prueba (por ejemplo `web-*.vercel.app`, `dash-*.vercel.app`) y comprobá que levantan.
3. Copiá variables de entorno necesarias en cada proyecto nuevo.

### Fase C (swap de dominios en minutos)
1. En el proyecto viejo (`apps/api`), quitá `nexid.lat` y `www.nexid.lat`.
2. En `nexid-web`, agregá `nexid.lat` + `www.nexid.lat`.
3. En `nexid-dashboard`, agregá `app.nexid.lat`.
4. En el proyecto de API (viejo o nuevo), dejá solo `api.nexid.lat`.
5. Redeploy en los tres proyectos.

### Fase D (opcional): reemplazar el proyecto viejo
Si querés, después creás un proyecto nuevo `nexid-api` con Root Directory `apps/api`, pasás `api.nexid.lat` ahí y archivás el proyecto inicial.

> Importante: en Vercel no se puede “sacar el redirect root del inicio” como toggle global del repo. El Root Directory es una configuración por proyecto/deployment, por eso la forma segura es crear proyectos separados y mover dominios.


## 9) ¿Qué hacer en *este* proyecto que hoy tiene `Root Directory = apps/api`?

Respuesta corta: **no lo conviertas a web todavía** si querés cero riesgo.

1. Dejá `Root Directory` en `apps/api` en este proyecto actual.
2. Dejá el switch **Include files outside the root directory in the Build Step** en `Enabled` (así no rompés builds del monorepo).
3. No borres variables de entorno ni DB de este proyecto.
4. Usá este proyecto como API temporal y mové dominios de forma controlada:
   - este proyecto: `api.nexid.lat`
   - proyecto nuevo `nexid-web` (`apps/web`): `nexid.lat` + `www.nexid.lat`
   - proyecto nuevo `nexid-dashboard` (`apps/dashboard`): `app.nexid.lat`

### ¿Cuándo sí cambiar ese Root Directory?
- Solo cuando ya tengas proyectos separados funcionando.
- Si querés “reciclar” este mismo proyecto para web, primero sacale `api.nexid.lat`, creá otro proyecto para `apps/api`, copiá env vars y recién ahí cambiá Root Directory.

Esto evita perder APIs, DB o secretos por mover todo de golpe.


## 10) Guía completa (click-by-click): pasar de 1 proyecto a 3 proyectos sin romper nada

> Objetivo: mantener vivo el proyecto actual (API), crear `web` y `dashboard` en paralelo, y recién al final mover dominios.

### 10.1 Antes de tocar dominios (pre-check)
1. En el proyecto actual (`apps/api`), confirmar que `https://<tu-proyecto>.vercel.app/health` responde 200.
2. En **Settings -> Environment Variables**, exportar/copy de variables actuales (al menos `DATABASE_URL`, secretos NFC/SUN/certificado, Clerk y `WEB_APP_URL`).
3. No borrar nada todavía (ni variables ni dominios).

### 10.2 Crear proyecto `nexid-web` (landing)
1. Vercel -> **Add New... -> Project**.
2. Seleccionar el mismo repo `NFC-Tokenizacion`.
3. En configuración del proyecto:
   - **Project Name:** `nexid-web`
   - **Root Directory:** `apps/web`
4. Deploy.
5. En `nexid-web` -> **Settings -> Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`
6. Redeploy para tomar env vars.

### 10.3 Crear proyecto `nexid-dashboard`
1. Vercel -> **Add New... -> Project**.
2. Mismo repo.
3. Configuración:
   - **Project Name:** `nexid-dashboard`
   - **Root Directory:** `apps/dashboard`
4. Deploy.
5. En `nexid-dashboard` -> **Settings -> Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`
   - Variables Clerk del dashboard; no copiar credenciales root del API.
6. Redeploy.

### 10.4 Dejar proyecto actual como API (`apps/api`)
En el proyecto original (el que ya existe):
1. **NO** cambiar Root Directory (dejar `apps/api`).
2. Mantener env vars de API (`DATABASE_URL`, secretos dedicados NFC/SUN/certificado, Clerk y `WEB_APP_URL=https://nexid.lat`).
3. Dominio final de este proyecto: `api.nexid.lat`.

### 10.5 Mover dominios en Vercel (orden exacto)
Hacerlo en este orden para evitar choques de ownership:
1. Proyecto viejo (`apps/api`): quitar `nexid.lat` y `www.nexid.lat`.
2. Proyecto `nexid-web`: agregar `nexid.lat` y `www.nexid.lat`.
3. Proyecto `nexid-dashboard`: agregar `app.nexid.lat`.
4. Proyecto API (viejo): agregar/dejar `api.nexid.lat`.
5. Redeploy de los 3 proyectos.

### 10.6 Qué tocar en Namecheap
En Namecheap solo administrás DNS de `nexid.lat`:
1. Ir a **Domain List -> Manage (nexid.lat) -> Advanced DNS**.
2. Asegurar estos records:
   - `@` (apex) -> según lo que pida Vercel al validar `nexid.lat` (A/ALIAS/CNAME flattening según plan/proveedor).
   - `www` -> CNAME al target que indica Vercel.
   - `app` -> CNAME al target que indica Vercel para dashboard.
   - `api` -> CNAME al target que indica Vercel para api.
3. No inventar targets manuales: usar exactamente el valor que Vercel muestra en cada dominio pendiente.
4. TTL: automático o 5 min (si está disponible).

### 10.7 Validación final
Probar en incógnito:
1. `https://nexid.lat` -> landing (web).
2. `https://www.nexid.lat` -> redirección única a `https://nexid.lat`.
3. `https://app.nexid.lat` -> dashboard.
4. `https://api.nexid.lat/health` -> JSON/200.

### 10.8 Proyecto de docs (opcional después)
Cuando todo esté estable:
1. Crear proyecto `nexid-docs` con Root Directory donde viva docs (por ejemplo `apps/docs` si existe en el repo).
2. Dominio recomendado: `docs.nexid.lat`.
3. Agregar `docs` en Namecheap como CNAME al target que indique Vercel.

### 10.9 Regla de oro
- Nunca mover Root Directory + dominios + env vars todo junto en un solo paso.
- Primero crear paralelo, después swap de dominios.


## 11) Emergencia: funciona `app.nexid.lat` pero `nexid.lat` y/o `api.nexid.lat` no

Checklist rápido (en este orden):

1. **Vercel web (`nexid-web`)**
   - `nexid.lat` debe estar en **Connect to environment (Production)**.
   - `nexid.lat` **NO** debe redirigir a `www.nexid.lat`.
   - Si querés canonicalizar, hacelo al revés: `www.nexid.lat` -> `nexid.lat`.

2. **Vercel api (`nexid-api`)**
   - `api.nexid.lat` en **Connect to environment (Production)**.
   - `api.nexid.lat` en **No Redirect**.

3. **Namecheap DNS**
   - Verificar que `@` (apex) apunta exactamente al target que pide Vercel para `nexid.lat`.
   - Si usás A record para apex, no dejar IP heredada/vieja de otro hosting.
   - `www`, `app`, `api` como CNAME a los targets que Vercel muestra.

4. **Nunca usar URL Redirect record en Namecheap** para `@`, `www`, `api`, `app`.

5. **Redeploy + caché**
   - Redeploy en `nexid-web` y `nexid-api`.
   - Probar en incógnito y, si sigue mal, limpiar DNS local (`ipconfig /flushdns` en Windows).

### Síntoma típico y causa
- Si `app.nexid.lat` funciona pero `nexid.lat` no, casi siempre el problema está en el apex (`@`) o en redirect invertido dentro de Vercel web.
