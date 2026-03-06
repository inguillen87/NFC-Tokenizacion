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
- `ADMIN_API_KEY=<secret>`
- `DATABASE_URL=<neon-url>`
- `POSTGRES_PRISMA_URL=<neon-prisma-url>` (si usás Prisma)

### apps/web
- `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`

### apps/dashboard
- `NEXT_PUBLIC_API_BASE_URL=https://api.nexid.lat`
- `ADMIN_API_KEY=<secret>` (solo server-side routes)

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
