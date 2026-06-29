# Final key flow

## One-time
Run `nfc_keys_final.bat DEMO-2026-02`.

If `secrets/kms-master.env` does not exist, the script creates it once.
That file is private and later its value goes to Vercel as `KMS_MASTER_KEY_HEX`.

## Per supplier sub-batch
The supplier-facing pack must expose:
- `K_META`
- `K_FILE`

for the authorized sub-batch only.

Legacy scripts or filenames may still derive keys from a batch id and call them `K_META_BATCH` / `K_FILE_BATCH`. Treat those as internal compatibility names. Do not use those names in factory copy, and do not send KMS terminology or database credentials to the supplier.

## Files created
- `secrets/kms-master.env` -> private, never sent to supplier
- `generated-keys/*.private.env` -> private archive
- `generated-keys/*.backend.env` -> use in your backend
- `generated-keys/*.supplier.txt` -> send only this to supplier, after confirming it contains only the authorized sub-batch `K_META`, `K_FILE`, URL template and manifest instructions
