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
