# Key flow (simple and correct)

## What each secret does

- `KMS_MASTER_KEY_HEX`
  - created **once**
  - kept **private**
  - stored in Vercel as env var
  - used by the backend to encrypt/decrypt batch keys at rest
  - **never** sent to supplier

- `K_META_BATCH` and `K_FILE_BATCH`
  - one pair **per batch**
  - sent to supplier
  - also sent to backend when creating the batch

## Important clarification

`KMS_MASTER_KEY_HEX` does **not** need to "match" previously generated batch keys.
The backend uses the KMS key only to **store** batch keys safely in DB.
So if you already sent `K_META_BATCH` and `K_FILE_BATCH` to the supplier, they still work.
You only need to create the batch in backend using those same raw batch keys while the chosen KMS key is already configured in Vercel.

## Recommended workflow

### First time

```powershell
powershell -ExecutionPolicy Bypass -File .\nfc_key_tool.ps1 -Mode bootstrap -OutDir .\keys
```

This creates `.\keys\.platform-kms.local.env`

### For each new batch

```powershell
powershell -ExecutionPolicy Bypass -File .\nfc_key_tool.ps1 -Mode batch -ClientSlug demo-mendoza -BatchId DEMO-2026-02 -OutDir .\keys
```

This creates:
- supplier file
- backend batch file

### One-liner to do both

```powershell
powershell -ExecutionPolicy Bypass -File .\nfc_key_tool.ps1 -Mode both -ClientSlug demo-mendoza -BatchId DEMO-2026-02 -OutDir .\keys
```
