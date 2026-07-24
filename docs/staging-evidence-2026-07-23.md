# Evidencia de staging — 2026-07-23

Se ejecutaron gates de lectura usando la configuración local existente, sin modificar base de datos ni emitir transacciones.

## IOTA V2 read-only

- Resultado: **PASS**.
- Chain ID: `1076`.
- Contrato: `0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`.
- Bytecode SHA-256: `be7dd5f09fe0663e759a79d7b1b7d490ca92b6bb8859ca9c7cbde61c5b824320`.
- `SCHEMA_VERSION`: `2`.
- Publisher de staging: autorizado.

Esto prueba disponibilidad RPC, contrato desplegado y esquema V2; no prueba un broadcast ni una reconciliación end-to-end.

## PostgreSQL

- Conectividad/versionado: **PASS** (`server_version_num=170010`, database `neondb`).
- Gate de esquema: **FAIL**.
- Faltan `evidence_anchor_attempts` e `iota_executor_publications`.
- Faltan columnas V2 en `evidence_anchors` y el índice `uq_iota_executor_publications_request`.
- Migraciones `0050`–`0054` registradas: ninguna.

Conclusión: el entorno es accesible pero no está listo para el runtime V2. La corrección requiere aprobación explícita para aplicar `0050`–`0054`; no se aplicaron durante este sprint.

## Preflight de migración

- Conectividad y permisos de esquema: **PASS**.
- `uuid-ossp`: **PASS**.
- Locks bloqueantes: `0`.
- Baseline `evidence_anchors`, `evidence_events`, `webhook_deliveries` y `webhook_endpoints`: presentes.
- Historial registrado: hasta `0049`; `0050`–`0054` pendientes.

El preflight fue sólo lectura; no creó `schema_migrations`, no tomó locks de escritura y no ejecutó SQL de migración.

El dry-run confirmó que `0050` debe confirmarse en una transacción separada: PostgreSQL no permite usar el nuevo enum `reconciling` dentro de la misma transacción que lo agrega. El script falló cerrado con `ENUM_VALUE_REQUIRES_COMMITTED_0050` y no persistió cambios.
