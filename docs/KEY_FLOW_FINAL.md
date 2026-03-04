# Final key flow

## Current sample batch
The sample batch already shared with the supplier uses **standalone batch keys**:
- `K_META_BATCH`
- `K_FILE_BATCH`

Those keys are valid as-is.

## What `KMS_MASTER_KEY_HEX` actually does
`KMS_MASTER_KEY_HEX` does **not** need to derive or regenerate the sample keys.
Its job is to encrypt/decrypt batch keys when storing them in the backend database.

Flow:
1. Supplier receives plaintext batch keys for the demo batch
2. Your backend stores those batch keys encrypted-at-rest using `KMS_MASTER_KEY_HEX`
3. When verifying a SUN scan, the backend decrypts the batch keys and uses them for validation

So the existing sample keys do **not** become invalid because the KMS master was created later.
