# Runbook de migraciones V2 en staging

Este procedimiento es deliberadamente manual: el preflight no modifica la base y una persona autorizada debe aprobar la mutación.

## Antes de aplicar

```bash
npm run gate:migrations:preflight
npm run gate:migrations:dry-run
```

Debe devolver `ok: true`, sin locks bloqueantes, con `uuid-ossp`, `evidence_anchors`, `evidence_events`, `webhook_deliveries` y `webhook_endpoints` presentes. Hacer backup/snapshot de staging y registrar el `schema_migrations` actual.

El dry-run ejecuta las cuatro migraciones dentro de una transacción y hace `ROLLBACK` siempre. Es una comprobación de compatibilidad, no una aplicación.

## Aplicación ordenada

Desde `apps/api`, con `DATABASE_URL` apuntando únicamente a staging:

```bash
npm run db:migrate --workspace=api -- --only 20260723193000_0050_evidence_anchor_reconciling_status.sql
npm run db:migrate --workspace=api -- --only 20260723193500_0051_iota_evidence_anchor_v2_writer.sql
npm run db:migrate --workspace=api -- --only 20260723194500_0052_webhook_delivery_outbox.sql
npm run db:migrate --workspace=api -- --only 20260723200500_0053_admin_login_abuse_guard.sql
npm run db:migrate --workspace=api -- --only 20260723213000_0054_iota_executor_publications.sql
```

También existe un wrapper seguro desde la raíz. Requiere confirmación explícita y bloquea producción:

```bash
STAGING_MIGRATION_APPROVED=YES NODE_ENV=staging DATABASE_URL=<staging-url> npm run apply:staging:v2
```

La utilidad PowerShell legacy también exige `-StagingApproved` (o la misma variable de entorno) cuando el archivo es `0050`–`0054`; no hay bypass por herramienta antigua.

Después de cada archivo, ejecutar `npm run gate:postgres:staging`. Al terminar, ejecutar `npm run gate:enterprise`, las suites API/executor y el smoke de dos instancias.

## Fallo y rollback

Las migraciones son forward-only y usan `IF NOT EXISTS`; no se debe borrar tablas ni ejecutar `DROP` como rollback automático. Si una migración falla, dejar la transacción revertida, conservar los logs y restaurar el snapshot sólo con aprobación del owner de staging. No continuar con el siguiente archivo hasta resolver la causa.

## Criterio de promoción

No promover si faltan columnas/índices, si el outbox no deduplica, si dos executors no coordinan por `proof_id`, si KMS no firma dentro del límite de tiempo o si el RPC no confirma el contrato V2.
