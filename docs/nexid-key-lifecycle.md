# nexID key lifecycle and supplier batch model

This document defines the production model for NTAG 424 DNA and NTAG 424 DNA TagTamper supplier batches.

## Core rule

`DEMO-2026-02` is a batch, not the product architecture.

Every real supplier carton must work through the same generic chain:

`tenant -> batch -> batch keys -> supplier encoding spec -> UID manifest -> activation -> SUN validation`

## Key roles

### KMS master key

`KMS_MASTER_KEY_HEX` lives only in the backend environment, for example Vercel API env.

It is not a chip key. It is not sent to the supplier. It is not stored in GitHub. It is used only to encrypt and decrypt per-batch keys at rest.

If this key is rotated, existing encrypted batch keys require a re-encryption plan.

### K_META_BATCH

`K_META_BATCH` is a per-batch AES-128 key, represented as 16 bytes / 32 hex chars.

It is sent to the supplier for chip encoding. The backend stores it encrypted in `batches.meta_key_ct`.

At tap time, the backend decrypts `picc_data` with this key to recover the UID and read counter.

If this key or the PICCData layout does not match the supplier encoding, `/sun` fails before UID decode and must report `SUN_PROFILE_MISMATCH`.

### K_FILE_BATCH

`K_FILE_BATCH` is a per-batch AES-128 key, represented as 16 bytes / 32 hex chars.

It is sent to the supplier for chip encoding. The backend stores it encrypted in `batches.file_key_ct`.

At tap time, the backend derives SDM session keys from this key, UID, and read counter. It validates CMAC and decrypts `enc`.

If this key or the MAC input layout does not match the supplier encoding, `/sun` must report a structured CMAC/layout error, not a manifest error.

## sdm_config

`sdm_config` is the source of truth for how a batch is validated and interpreted.

Standard NTAG 424 DNA TagTamper profile:

```json
{
  "mac_input": "enc_plus_cmac_literal",
  "ttstatus_enabled": true,
  "ttstatus_source": "enc_decrypted",
  "ttstatus_offset": 0,
  "ttstatus_length": 2,
  "ttstatus_closed_values": ["4343"],
  "ttstatus_opened_values": ["4F4F", "4F43"],
  "ttstatus_invalid_values": ["4949"],
  "carrier_profile_code": "ntag424_dna_tt",
  "chip_model": "NTAG 424 DNA TagTamper"
}
```

Business state must not be inferred from one byte. `encPlainStatusByte` is debug only. The only TagTamper source is the full two-byte `tt_raw` parsed from the configured decrypted payload offset.

## UID manifest

The UID manifest is stock and allowlist data only. It contains no secrets.

Accepted minimal format:

```txt
uid_hex
04AABBCCDDEEFF
04AABBCCDDEE00
```

Accepted CSV format:

```csv
batch_id,uid_hex
NXD2606-A01,04AABBCCDDEEFF
NXD2606-A01,04AABBCCDDEE00
```

If `/sun` cannot decode UID, the manifest is not the first thing to inspect. Fix keys/layout first.

## Supplier encoding package

The platform can generate or register `K_META_BATCH` and `K_FILE_BATCH` for each supplier batch, then export an encoding package to the supplier.

The package may include:

```json
{
  "batch_id": "NXD2606-A01",
  "chip_model": "NTAG 424 DNA TagTamper",
  "k_meta_batch": "<32_HEX_CHARS>",
  "k_file_batch": "<32_HEX_CHARS>",
  "url_template": "https://api.nexid.lat/sun?v=1&bid=NXD2606-A01&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  "ttstatus": {
    "enabled": true,
    "source": "enc_decrypted",
    "offset": 0,
    "length": 2,
    "closed": ["4343"],
    "opened": ["4F4F", "4F43"],
    "invalid": ["4949"]
  },
  "manifest_format": "uid_hex one per row"
}
```

The package must never include `KMS_MASTER_KEY_HEX`, database URLs, Vercel tokens, admin tokens, or private API keys.

## Receiving checklist

Before releasing a supplier carton:

1. Create tenant.
2. Create batch in `planned` or `pending_supplier`.
3. Generate or register `K_META_BATCH` and `K_FILE_BATCH`.
4. Store encrypted keys in DB.
5. Export supplier encoding package.
6. Import supplier UID manifest.
7. Activate tags.
8. Scan one intact tag and expect UID decoded plus `tt_raw = 4343`.
9. Reuse the same URL and expect `REPLAY_SUSPECT`.
10. Break one sacrificial tag and expect `tt_raw = 4F4F` or `4F43`.
11. Approve batch for sale.

## /sun decision tree

The validator must use structured fields, not human reason text:

1. Missing params -> `MALFORMED_URL`
2. Batch not found -> `UNKNOWN_BATCH`
3. Batch revoked -> `INVALID`
4. SUN crypto fails before UID -> `SUN_PROFILE_MISMATCH`
5. UID decoded but not in manifest -> `NOT_REGISTERED`
6. UID decoded but inactive -> `NOT_ACTIVE`
7. Replayed URL -> `REPLAY_SUSPECT`
8. Valid plus `tt_raw = 4343` -> `VALID_CLOSED`
9. Valid plus `tt_raw = 4F4F` -> `VALID_OPENED`
10. Valid plus `tt_raw = 4F43` -> `VALID_OPENED_PREVIOUSLY`
11. Valid with no TTStatus -> `VALID_UNKNOWN_TAMPER`

If UID is null, the problem is SUN crypto/layout, not manifest.
