# Runbook de migraciones IOTA V2 en staging

Este procedimiento aplica `0050`–`0055` únicamente a una rama Neon de staging
identificada y aprobada. Los gates nunca imprimen usuario, contraseña, host ni
connection string. La identidad visible se limita a endpoint ID, base, rol,
versión y fingerprints SHA-256 sin secretos.

## Invariantes obligatorios

- Usar `STAGING_DATABASE_URL`, nunca `DATABASE_URL`, y debe ser la URL **unpooled** de Neon.
- `STAGING_DATABASE_ENDPOINT_ALLOWLIST` debe contener el endpoint ID exacto (`ep-...`). No se aceptan substrings.
- `STAGING_MIGRATION_EXPECTED_BASELINE_LEDGER` debe enumerar todo el ledger previo, no sólo la última migración.
- No ejecutar `npm run db:migrate` sin `--only`: el endpoint auditado tiene un ledger histórico disperso y un replay global es inseguro.
- El runner es dueño de `BEGIN/COMMIT`; ningún archivo SQL puede incluir control de transacción.
- `0050` se confirma sola. Recién después se ejecuta el dry-run rollback-only de `0051`–`0055`.
- Antes de mutar staging debe existir una prueba exitosa en una rama descartable y un snapshot/branch de recuperación de staging.
- Rollback operativo = restore de Neon. No se ejecutan `DROP TABLE`, `DROP COLUMN` ni una down migration destructiva.

## Configuración protegida

Usar la URL unpooled de la rama `nexid-staging` y confirmar en Neon Console que
el endpoint pertenece a esa rama. SQL puede detectar el endpoint ID, pero no el
nombre de la rama.

```powershell
$env:STAGING_DATABASE_URL = '<Neon unpooled staging URL>'
$env:STAGING_DATABASE_ENDPOINT_ALLOWLIST = 'ep-xxxxxxxxxxxxxxxx'
$env:STAGING_MIGRATION_EXPECTED_BASELINE_LEDGER = @(
  '0001_initial.sql',
  '0002_crm_assistant.sql',
  '20260530002000_0035_demobodega_ttstatus_config_guard.sql',
  '20260530013000_0036_batches_bid_unique_guard.sql',
  '20260711044500_0045_consumer_wallet_control_challenges.sql',
  '20260711213000_0046_carrier_profile_family_expansion.sql',
  '20260711221000_0047_evidence_anchor_local_status.sql',
  '20260711222000_0048_evidence_anchor_legacy_hashes_nullable.sql',
  '20260712053000_0049_tokenization_simulation_truth.sql'
) -join ','
```

Si el ledger cambia, no se edita la lista a ciegas: se audita la causa y se
captura una nueva evidencia aprobada.

## 1. Preflight estrictamente read-only

```powershell
npm run check:migrations:safety
npm run gate:migrations:preflight
```

Debe devolver `ok: true`, cuatro tablas baseline presentes, `uuid-ossp`, rol
owner con `USAGE/CREATE`, cero locks bloqueantes, cero residuos V2 y coincidencia
exacta del ledger. Guardar `target.target_fingerprint`, `schema_fingerprint` y
`ledger.sha256`. El `schema_fingerprint` se reutiliza como
`STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT`.

## 2. Ensayo en una rama descartable

Crear desde el mismo punto de staging una rama Neon descartable. Repetir el
preflight con el endpoint de esa rama en la allowlist. Aplicar `0050` sola:

```powershell
$env:DATABASE_URL = $env:STAGING_DATABASE_URL
npm run db:migrate --workspace=api -- --only 20260723193000_0050_evidence_anchor_reconciling_status.sql
Remove-Item Env:\DATABASE_URL
npm run gate:migrations:dry-run
```

El dry-run ejecuta `0051`–`0055` dentro de una única transacción con advisory
lock, `lock_timeout=3s` y `statement_timeout=30s`, y siempre hace `ROLLBACK`.
Debe devolver fingerprints before/after iguales y `rollback_verified: true`.

Después, aplicar `0051`–`0055` individualmente con `--only`, ejecutar
`npm run gate:migrations:postcheck`, las suites API/executor y el smoke de dos
instancias. Guardar el enlace o ID de esa ejecución como evidencia de rehearsal.

## 3. Checkpoint de staging

Inmediatamente antes de staging real:

1. Crear snapshot o backup branch de Neon desde el endpoint allowlisteado.
2. Abrir una conexión read-only al checkpoint y verificar los mismos counts y ledger.
3. Registrar snapshot/branch ID y timestamp como `STAGING_MIGRATION_BACKUP_REFERENCE`.
4. Registrar la evidencia del ensayo como `STAGING_MIGRATION_REHEARSAL_EVIDENCE`.
5. Pausar workers/rutas que ejecutan auto-DDL (`ensureSupplierOpsSchema` y `ensureEnterpriseIamSchema`) durante la ventana.

## 4. Aplicación controlada

```powershell
$env:NODE_ENV = 'staging'
$env:STAGING_MIGRATION_APPROVED = 'YES'
$env:STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT = 'sha256:<preflight>'
$env:STAGING_MIGRATION_BACKUP_REFERENCE = '<snapshot-or-backup-branch-id>'
$env:STAGING_MIGRATION_REHEARSAL_EVIDENCE = '<approved-run-id-or-url>'
npm run apply:staging:v2
```

El wrapper vuelve a validar target, allowlist, ledger y fingerprint; aplica
`0050`, verifica el ledger, ejecuta el dry-run de `0051`–`0055`, aplica cada
archivo con transacción+ledger atómicos y termina con postcheck. Ante cualquier
fallo se detiene y devuelve `last_completed_migration` y `rollback_required`.

## 5. Postcheck

```powershell
npm run gate:migrations:postcheck
npm run gate:enterprise
```

El gate exige las seis entradas exactas del ledger, todas las tablas/columnas,
constraints, el state machine `reserved → signed → broadcast → submitted →
confirmed`, los índices de idempotencia y cero filas incompatibles. El SQL
read-only equivalente para evidencia manual está en
`apps/api/db/ops/iota-v2-postcheck.sql`.

Las dos constraints `evidence_anchors_iota_v2_*` nacen `NOT VALID`. Staging
puede quedar funcional, pero `production_ready` seguirá `false` hasta una
migración forward-only que las valide. No ocultar esa diferencia.

## 6. Rollback

Si falla antes de un `COMMIT`, el runner hace rollback automático. Si una fase
ya quedó confirmada o falla el postcheck:

1. Mantener API/executor IOTA pausados.
2. Restaurar el snapshot/backup branch registrado en Neon.
3. Apuntar `STAGING_DATABASE_URL` al endpoint restaurado y conservar la misma allowlist aprobada.
4. Ejecutar:

```powershell
npm run gate:migrations:rollback-verify
```

El gate exige el ledger baseline exacto, ausencia total de `0050`–`0055`,
ausencia de objetos V2 y coincidencia exacta con
`STAGING_MIGRATION_PRECHANGE_SCHEMA_FINGERPRINT`. El SQL auxiliar read-only es
`apps/api/db/ops/iota-v2-rollback-verify.sql`.

No intentar eliminar el enum `reconciling` ni tablas/columnas manualmente: una
down migration parcial puede perder evidencia o dejar esquema y ledger en
estados distintos.
