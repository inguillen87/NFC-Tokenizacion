# nexID production database migrations

Objetivo: mantener la base de datos de produccion alineada con el codigo sin depender de fallbacks runtime.

## Migration actual

Archivo:

```text
apps/api/db/migrations/20260502195500_0026_tokenization_loyalty_schema_hardening.sql
```

Incluye:

- `tokenization_requests` para cola y auditoria de tokenizacion Polygon Amoy.
- `loyalty_programs`, `loyalty_members`, `points_ledger`, `rewards`, `reward_redemptions`.
- Indices de consulta para portal consumidor, admin loyalty y requests de tokenizacion.
- Seed minimo de `demobodega`: `Club Terroir` + rewards demo.

## Aplicar solo esta migration

No pegues `DATABASE_URL` en chats. Pegalo solo en el prompt oculto del script.

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion

powershell -ExecutionPolicy Bypass -File .\scripts\api-db-apply-migration-file.ps1
```

El script pide:

```text
Paste DATABASE_URL de Neon/Postgres (input hidden)
```

Salida esperada:

```json
{"ok":true,"applied":true,"migration":"20260502195500_0026_tokenization_loyalty_schema_hardening.sql"}
```

Si ya estaba aplicada:

```json
{"ok":true,"skipped":true,"migration":"20260502195500_0026_tokenization_loyalty_schema_hardening.sql"}
```

## Verificar despues

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion

powershell -ExecutionPolicy Bypass -File .\scripts\api-loyalty-overview.ps1

powershell -ExecutionPolicy Bypass -File .\scripts\api-tokenization-requests.ps1 -Limit 10
```

Esperado:

- `/mobile/loyalty/overview` deja de devolver 500.
- `/admin/tokenization/requests` deja de devolver 500.
- Un tap SUN valido puede crear request y anclar token en Polygon Amoy si `SUN_AUTO_TOKENIZE_ON_VALID_TAP=true`.

## Nota operativa

El codigo tambien tiene guards runtime (`ensureLoyaltySchema` y `ensureTokenizationRequestsSchema`) para evitar caidas si un ambiente preview nace incompleto. Eso es proteccion secundaria. La fuente profesional de verdad sigue siendo la migration versionada.
