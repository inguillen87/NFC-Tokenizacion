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
   - `ADMIN_API_KEY`
   - `KMS_MASTER_KEY_HEX`
5. Deploy

## DB
Ejecuta:
```bash
psql "$DATABASE_URL" -f apps/api/db/schema.sql
```

## Healthcheck
- `/health/`
- `/sun/`

## Orden correcto
1. Deploy `apps/api`
2. Crear tenant demo
3. Crear batch demo con las dos sample keys del proveedor
4. Importar manifest
5. Activar UIDs
6. Probar tags
7. Recien despues tocar `apps/web` y `apps/dashboard`

## Nota clave sobre keys
- `KMS_MASTER_KEY_HEX` = solo backend / Vercel / privado
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
