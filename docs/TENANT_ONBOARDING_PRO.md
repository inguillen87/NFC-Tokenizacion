# nexID Tenant Onboarding Pro

Este flujo evita tenants genericos, fallbacks y demos accidentales. Cada tenant nuevo debe quedar listo para operar tags reales antes de exponer CTAs de consumidor, marketplace, ownership o tokenizacion.

## Camino recomendado

Usar el dashboard:

`/batches/supplier`

La pantalla guia el flujo completo:

1. Crear o actualizar tenant con passport SUN completo.
2. Registrar batch real con identidad tecnica y llaves de proveedor.
3. Importar manifest TXT/CSV con preflight.
4. Activar tags importadas.
5. Validar URL SUN real de muestra.
6. Entregar portal, marketplace, permisos y tokenizacion solo si el tap pasa las politicas.

`demobodega` existe solo como piloto explicito. Para nuevos tenants no hay defaults silenciosos.

## 1. Crear tenant con perfil SUN

`POST /admin/tenants` requiere:

- `slug`, `name`
- `vertical`: `wine`, `events`, `cosmetics`, `agro`, `pharma` o `luxury`
- `club_name`
- `product_label`
- `origin_label`, `origin_address`, `origin_lat`, `origin_lng`
- `tokenization_mode`: `valid_only`, `valid_and_opened` o `manual`
- `claim_policy`: `purchase_proof_required`, `retailer_attested`, `inside_pack_secret` o `admin_approved`
- `ownership_policy`
- `manifest_policy`

Ejemplo:

```json
{
  "slug": "bodega-altamira",
  "name": "Bodega Altamira",
  "vertical": "wine",
  "club_name": "Club Altamira",
  "product_label": "Vino premium",
  "origin_label": "Valle de Uco, Mendoza",
  "origin_address": "Finca Altamira, Mendoza, Argentina",
  "origin_lat": -33.3667,
  "origin_lng": -69.15,
  "tokenization_mode": "valid_and_opened",
  "claim_policy": "purchase_proof_required",
  "ownership_policy": {
    "requiresPurchaseProof": true,
    "requiresFreshTap": true,
    "requiresTenantMembership": true,
    "allowsPublicClaim": false,
    "antiReplayRequired": true
  },
  "manifest_policy": {
    "acceptedFormats": ["csv", "txt"],
    "requiredColumns": ["uid_hex"],
    "csvOptionalColumns": ["batch_id", "product_name", "sku", "lot", "serial", "expires_at"],
    "activateDefault": false,
    "rejectDuplicates": true
  }
}
```

## 2. Crear batch real

`POST /admin/batches/register` bloquea si el tenant no tiene perfil SUN completo.

El batch debe declarar:

- `tenant_slug`
- `bid`
- `mode`: `supplier` o `internal`
- `security_profile`
- `sku`
- `chip_model`
- `k_meta_hex` y `k_file_hex` en modo `supplier`

En modo proveedor no se autogeneran llaves.

## 3. Importar manifest

Usar `POST /admin/batches/{bid}/import-manifest`.

CSV recomendado:

```csv
batch_id,uid_hex,product_name,sku,lot,serial,expires_at
DEMO-2026-02,04AABBCCDD1090,Gran Reserva Malbec,MZA-2026-0424,L-0424,S-001,
```

Reglas:

- Si `batch_id` viene en el CSV, debe coincidir con la ruta.
- Duplicados dentro del archivo se rechazan.
- UIDs invalidos se rechazan.
- CSV requiere `product_name` o `sku`.
- TXT UID-only se acepta desde el wizard/CLI solo si se completa producto/SKU para convertirlo en CSV auditable.
- Cada intento queda auditado en `tenant_manifests`.

## 4. Tap SUN

`/sun` no inventa tenant/producto si falta configuracion.

Si el tenant esta incompleto, responde `TENANT_SETUP_REQUIRED` y bloquea:

- ownership
- garantia
- tokenizacion
- marketplace
- rewards

Cuando tenant, batch y manifest estan completos, el tap habilita CTAs segun el veredicto real:

- Fresh valid tap: acciones permitidas segun policy.
- Replay: ownership/tokenizacion bloqueados.
- Tamper/opened: lifecycle real, no producto invalido generico.

## 5. CLI auditado

El script `apps/api/scripts/bootstrap-enterprise-tenant.mjs` ahora usa la API real. No escribe directo en tablas, no crea `demobodega` por defecto y no guarda llaves crudas.

Ejemplo:

```powershell
$env:ADMIN_API_KEY="<tu-admin-api-key>"
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
node scripts/bootstrap-enterprise-tenant.mjs `
  --api-url=https://api.nexid.lat `
  --tenant=bodega-altamira `
  --tenant-name="Bodega Altamira" `
  --vertical=wine `
  --club-name="Club Altamira" `
  --product-label="Gran Reserva Malbec" `
  --origin-label="Valle de Uco, Mendoza" `
  --origin-address="Finca Altamira, Mendoza, Argentina" `
  --origin-lat=-33.3667 `
  --origin-lng=-69.15 `
  --tokenization-mode=valid_and_opened `
  --claim-policy=purchase_proof_required `
  --batch-bid=ALTAMIRA-2026-01 `
  --mode=supplier `
  --security-profile=ntag424dna_tt `
  --sku=MZA-2026-ALT `
  --chip-model=NTAG424_DNA_TT `
  --manifest=C:\manifests\altamira-2026-01.csv `
  --activate-imported=true `
  --k-meta-hex=<32-hex> `
  --k-file-hex=<32-hex>
```

## 6. Aplicar migrations

Si produccion muestra errores como `relation "tokenization_requests" does not exist` o `relation "loyalty_programs" does not exist`, aplicar primero la migration de tokenizacion/loyalty y despues las de tenant passport.

Desde la raiz:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\api-db-apply-migration-file.ps1 -Migration "20260502195500_0026_tokenization_loyalty_schema_hardening.sql"
powershell -ExecutionPolicy Bypass -File .\scripts\api-db-apply-migration-file.ps1 -Migration "20260502203000_0027_tenant_sun_profiles.sql"
powershell -ExecutionPolicy Bypass -File .\scripts\api-db-apply-migration-file.ps1 -Migration "20260502211500_0028_strict_tenant_manifest_onboarding.sql"
```

Pegar `DATABASE_URL` de Neon/Vercel cuando lo pida.
