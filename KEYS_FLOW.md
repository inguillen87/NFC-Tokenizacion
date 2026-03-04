# One key flow only

## Una sola regla
- `secrets/kms-master.env` = private / backend / Vercel
- `generated-keys/*-supplier.txt` = proveedor
- `generated-keys/*.env` = backend batch actual

## Batch demo actual
Si ya le mandaste dos sample keys al proveedor para `DEMO-2026-02`, esas son las que tenes que cargar en el backend para ese batch.
La master nueva **no cambia** ni recalcula ese batch demo viejo.

## Para el proximo batch
Ejemplo:
```powershell
powershell -ExecutionPolicy Bypass -File .\nfc_keys.ps1 -ClientSlug demo-mendoza -BatchId DEMO-2026-02
```
