# Borradores de campaña persistidos

Incremento sobre API `210edf69`. No implementa aprobación ni envío. La audiencia
se sigue resolviendo por consentimiento actual, separada del contenido guardado.

## Contrato

- GET/POST `/admin/campaigns/drafts?tenant=...`; GET/PATCH `.../drafts/:id?tenant=...`.
- `campaigns:read` para consultas, `campaigns:write` para cambios; empresa explícita
  y verificada contra el principal de cualquier rol no global.
- Creación con `Idempotency-Key`, UUID/fechas/autor del servidor. La misma clave y
  solicitud no duplica registros; una solicitud distinta devuelve conflicto.
- PATCH exige `expectedRevision`. Archivo y restauración son cambios recuperables.
- Una escritura y su auditoría se confirman en la misma sentencia SQL. La auditoría
  guarda hashes de contenido, no destinatarios ni texto de campaña.

## Validación de base

Migración: `20260906120000_0102_campaign_drafts.sql`.
SHA256 probado: `84ab1f85dc831440c7846c401001f8be50a6fad24aace7be1603bcb51dea1ab3`.

Rama QA `br-royal-rain-ai22lgwg`, derivada de `br-jolly-butterfly-aivukyzq`,
endpoint `ep-curly-fire-aixp1rdj`, expira el 8 de septiembre a las 12:00 UTC.
No se cambiaron credenciales de aplicaciones ni archivos `.env`.

El runner `scripts/db-campaign-drafts-migration.mjs` exige endpoint y hash,
conexión directa y migra tabla + ledger en transacción. `dry-run` aplicó y deshizo
correctamente; `apply` confirmado sólo en QA al escribir esta entrada. También
se confirmó el dry-run revertido contra el endpoint productivo, sin persistencia.

`scripts/validate-campaign-drafts-postgres-qa.mjs` sólo admite ese endpoint de QA.
Resultado con dos conexiones independientes:

- Dos creaciones simultáneas: un UUID, una creación y una respuesta idempotente.
- Misma clave con otro contenido: conflicto.
- Dos ediciones sobre v1: una v2 y un conflicto; no se pierde la edición ganadora.
- Reintento de creación tras edición: preserva UUID, contenido actual y fingerprint.
- Archivo v3 y restauración v4, recuperados desde otra conexión.
- Aislamiento de lectura/escritura/listado entre dos empresas de la rama.
- Cuatro auditorías para crear/editar/archivar/restaurar; ningún duplicado por reintento.

Datos sintéticos retenidos en la rama con expiración, no en producción. No se
ejecutaron proveedores de mensajes, canjes ni cambios de consentimiento.

Pruebas locales API: 84 distintas aprobadas, sin fallos ni omisiones; TypeScript
correcto. La publicación y el QA público se registran por separado tras promoción.
