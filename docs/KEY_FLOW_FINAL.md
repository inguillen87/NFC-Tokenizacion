# Final key flow

## One-time
Run `nfc_keys_final.bat DEMO-2026-02`.

If `secrets/kms-master.env` does not exist, the script creates it once.
That file is private and later its value goes to Vercel as `KMS_MASTER_KEY_HEX`.

## Per batch
The same script derives:
- `K_META_BATCH`
- `K_FILE_BATCH`

from the master key + batch id.

## Files created
- `secrets/kms-master.env` -> private, never sent to supplier
- `generated-keys/*.private.env` -> private archive
- `generated-keys/*.backend.env` -> use in your backend
- `generated-keys/*.supplier.txt` -> send only this to supplier
