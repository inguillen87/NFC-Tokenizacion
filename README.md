# Product Identity Platform — Vercel-safe v1

Monorepo con tres apps:
- `apps/api` → backend NFC / SUN / batches / manifest
- `apps/web` → landing publica
- `apps/dashboard` → dashboard shell

## Lo primero: deploy solo API
En Vercel:
1. Importa el repo
2. `Root Directory` = `apps/api`
3. Framework = `Next.js`
4. Variables:
   - `DATABASE_URL`
   - `NFC_ENVELOPE_KEK_VERSION` + la clave `NFC_ENVELOPE_KEK_<VERSION>_HEX`
   - `PUBLIC_CERTIFICATE_SIGNING_SECRET`
   - `SUN_HANDOFF_SECRET`
   - `CLERK_SECRET_KEY` y `CLERK_AUTHORIZED_PARTIES`
   - `OPENAI_API_KEY` *(solo si querés habilitar `/assistant/chat`)*
5. Deploy


## OPENAI_API_KEY: dónde configurarla
- **Obligatoria en `apps/api`** (ahí se llama a OpenAI desde `apps/api/src/app/assistant/chat/route.ts`).
- **No hace falta en `apps/web` ni `apps/dashboard`** en la implementación actual: esas apps solo hacen proxy al endpoint de API.
- En `web`/`dashboard` configurá `API_BASE_URL` (o `NEXT_PUBLIC_API_BASE_URL`) para apuntar al deployment de `apps/api`.

## DB
Ejecuta:
```bash
psql "$DATABASE_URL" -f apps/api/db/schema.sql
```

## Healthcheck
- `/health/`
- `/sun/`

## Root redirect for API deployment
If your Vercel project root is `apps/api`, set `WEB_APP_URL` so `/` redirects to the public platform (`apps/web`) instead of showing an API placeholder page.

## Orden correcto
1. Deploy `apps/api`
2. Crear tenant demo
3. Crear batch demo con las dos sample keys del proveedor
4. Importar manifest
5. Activar UIDs
6. Probar tags
7. Recien despues tocar `apps/web` y `apps/dashboard`

## Nota clave sobre keys
- El KEK NFC configurado en Vercel es envelope encryption por software; no se presenta como KMS/HSM.
- `K_META_BATCH` y `K_FILE_BATCH` = un batch especifico
- El batch demo actual usa exactamente las dos sample keys que ya le mandaste al proveedor.
- La master no reescribe ni recalcula batches viejos.


## Migrations (new workflow)

Use migration scripts instead of manual SQL pasting:

```bash
npm run db:new -- <name>
npm run db:migrate
npm run db:seed
npm run db:reset:local
```

Detailed guide: `docs/MIGRATIONS.md`.


## ¿Qué significa `/health` y `/sun`?
- `GET /health` responde estado del backend (`ok:true`) y confirma que el servicio está levantado.
- `GET /sun` valida lecturas SUN/SDM de tags en tiempo real. Si responde correctamente con parámetros válidos, la autenticación NFC está operativa.

## Checklist para enviar al proveedor de chips (NDEF / pedido)
Enviarles este paquete técnico mínimo:
1. **URL pública de validación**: `https://api.nexid.lat/sun`
2. **Dominio landing UX**: `https://nexid.lat`
3. **Perfil de chip por caso**:
   - Eventos/fiestas costo bajo: `NTAG215`.
   - Anti-clon / tamper alto riesgo: `NTAG 424 DNA TagTamper`.
4. **Formato de payload/UID por lote** (bid + uid + ctr según integración SUN).
5. **Cantidad inicial por SKU** (ej: 10k/25k/50k) y si incluyen encoding en fábrica o encoding local.
6. **Prueba de smoke**: compartir captura de `GET /health` en producción + validación real en `/sun` con un tag de test.

Con eso el proveedor puede cerrar fabricación + encoding + logística inicial sin fricción.


## Seguridad perimetral y automatización
- Base preparada para alta escala: migración `0003_events_partition_geo_perf.sql` agrega particionamiento mensual de `events` + índices de performance para analítica.
- `GET /sun` aplica rate limit básico por IP en runtime (`SUN_RATE_LIMIT_PER_MIN`, default 120 rpm).
- Para protección DDoS enterprise, complementar con reglas de Vercel Edge/WAF por ruta `/sun`.
- Webhooks de escaneo válido: configurá `SCAN_WEBHOOK_URL` (y opcional `SCAN_WEBHOOK_SECRET`) para recibir eventos `tag.scan.valid` en tu ERP/CRM.


## Demo map configuration (dashboard)

For production-grade map hosting (enterprise hardening), define these env vars in `apps/dashboard/.env`:

- `NEXT_PUBLIC_MAPLIBRE_STYLE_URL`

These are required for enterprise mode (no public CDN fallback).

## Trust map configuration (web, dashboard, API)

The customer-facing maps now use a shared nexID trust-map source resolver. The default is a free raster fallback for demos, but production can point to self-hosted raster tiles or a PMTiles asset hosted in your own storage/CDN.

Browser apps (`apps/web`, `apps/dashboard`):

- `NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE`
- `NEXT_PUBLIC_NEXID_PMTILES_URL`
- `NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION`

API post-tap passport (`apps/api`):

- `NEXID_RASTER_TILE_TEMPLATE`
- `NEXID_PMTILES_URL`
- `NEXID_MAP_ATTRIBUTION`

Recommended production path: generate tenant/region PMTiles offline, serve them from nexID-controlled storage/CDN, and keep the raster template as fallback while the vector renderer is introduced.
