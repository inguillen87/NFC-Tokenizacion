# nexID key lifecycle and supplier batch model

This document defines the production model for NTAG 424 DNA and NTAG 424 DNA TagTamper supplier batches.

## Core rule

`DEMO-2026-02` is a batch, not the product architecture.

Every real supplier carton must work through the same generic chain:

`tenant -> supplier order -> sub-batch -> sub-batch keys -> supplier encoding spec -> UID manifest -> controlled SUN/TT QA -> production acceptance -> atomic activation`

## Key roles

### Pilot application envelope key (legacy env name)

`KMS_MASTER_KEY_HEX` lives only in the backend environment, for example Vercel API env.

Despite its historical name, this is a raw application secret, not a managed KMS key handle and not HSM-backed custody. Customer and UI copy must call it **pilot application envelope encryption**, never KMS/HSM.

It is not a chip key. It is not sent to the supplier. It is not stored in GitHub. It encrypts explicitly context-bound NFC/application-envelope secrets, including per-batch keys, tenant root material and QA selection/challenge material; it must never be reused for Polygon, IOTA or webhook signing. New ciphertext uses a versioned AES-256-GCM envelope whose authenticated AAD binds tenant, BID, key role, lifecycle version and KEK version. Existing unversioned sample ciphertext remains readable during migration.

For rotation, set `NFC_ENVELOPE_KEK_VERSION` to the new version and keep the prior key temporarily under `NFC_ENVELOPE_KEK_<OLD_VERSION>_HEX` for dual-read. Because legacy envelopes do not embed a version, pin `NFC_LEGACY_ENVELOPE_KEK_VERSION` to the old version until every legacy sample/row has been re-enveloped and audited. Backfill and verify every ciphertext before removing the old secret. This improves application-level isolation but does not turn Vercel environment variables into KMS or HSM.

### K_META

`K_META` is the supplier-facing name for the per-sub-batch AES-128 key, represented as 16 bytes / 32 hex chars.

It is sent to the supplier only for the authorized sub-batch. The backend stores it encrypted in the batch/sub-batch key ciphertext field such as `batches.meta_key_ct`.

At tap time, the backend decrypts `picc_data` with this key to recover the UID and read counter.

If this key or the PICCData layout does not match the supplier encoding, `/sun` fails before UID decode and must report `SUN_PROFILE_MISMATCH`.

### K_FILE

`K_FILE` is the supplier-facing name for the per-sub-batch AES-128 key, represented as 16 bytes / 32 hex chars.

It is sent to the supplier only for the authorized sub-batch. The backend stores it encrypted in the batch/sub-batch key ciphertext field such as `batches.file_key_ct`.

At tap time, the backend derives SDM session keys from this key, UID, and read counter. It validates CMAC and decrypts `enc`.

If this key or the MAC input layout does not match the supplier encoding, `/sun` must report a structured CMAC/layout error, not a manifest error.

## sdm_config

`sdm_config` is the source of truth for how a batch is validated and interpreted.

Standard NTAG 424 DNA TagTamper profile:

```json
{
  "mac_input": "enc_plus_cmac_literal",
  "mac_input_candidates": [
    "enc_plus_cmac_literal",
    "enc_only_ascii",
    "query_from_enc_to_cmac",
    "query_from_picc_data_to_cmac"
  ],
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

If a supplier APK runs `ChangeFileSet`, assume SDM offsets or `SDMMACInputOffset` may have changed until proven otherwise. In that case, use `POST /admin/sun/debug-verify` with a fresh physical `/sun` URL. The endpoint tests diagnostic CMAC input candidates and reports the matching candidate, if any. Production authenticity must still use only the selected `sdm_config.mac_input` for the batch.

Supported CMAC input modes:

- `enc_plus_cmac_literal`: ASCII `ENC&cmac=`
- `enc_only_ascii`: ASCII `ENC`
- `query_from_enc_to_cmac`: ASCII `enc=ENC&cmac=`
- `query_from_picc_data_to_cmac`: ASCII `picc_data=PICC&enc=ENC&cmac=`

If none of those candidates match, the likely causes are wrong `K_META`, wrong `K_FILE`, changed PICCData layout, changed file settings, or supplier programming drift. Do not inspect the UID manifest first when UID is null.

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

The platform can generate or register `K_META` and `K_FILE` for each supplier sub-batch, then export an encoding package to the supplier.

The package may include:

```json
{
  "order_id": "SUP-2026-00041",
  "batch_id": "NXD2606-A01",
  "sub_batch_id": "NXD2606-A01-R001",
  "bid": "NXD2606-A01-R001",
  "chip_model": "NTAG 424 DNA TagTamper",
  "K_META": "<32_HEX_CHARS>",
  "K_FILE": "<32_HEX_CHARS>",
  "url_template": "https://api.nexid.lat/sun?v=1&bid=NXD2606-A01-R001&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
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

The package must never include `KMS_MASTER_KEY_HEX`, versioned NFC envelope KEKs, managed-KMS credentials or key handles, `DATABASE_URL`, database URLs, Vercel tokens, admin tokens, Polygon minter keys, executor secrets, or private API keys. The factory receives `K_META` and `K_FILE` for the authorized sub-batch, never an application KEK, KMS access or database access.

## Receiving checklist

Before releasing a supplier carton:

1. Create the tenant and batch in `planned` or `pending_supplier`.
2. Approve the Packaging Lab specification and the tenant-owned production QA plan.
3. Generate or register `K_META` and `K_FILE` for each secure sub-batch and store them encrypted in DB.
4. Export the supplier encoding package through the privileged audited path.
5. Dry-run and then import the supplier UID manifest.
6. For `ntag424_dna` without TT, scan one tag and require decoded UID, valid
   CMAC and `VALID_AUTHENTIC`; do not invent an opening test.
7. For `ntag424_dna_tt`, scan one intact tag and require decoded UID plus
   `tt_raw = 4343`, then break one sacrificial tag and require `tt_raw = 4F4F`
   or `4F43`.
8. Reuse a captured URL for the applicable profile and require
   `REPLAY_SUSPECT`.
9. Commit Supplier Production Acceptance with the required dual control.
10. Activate the accepted batch atomically and only then release it for sale.

Never activate production tags before the applicable physical and cryptographic evidence is complete.

## /sun decision tree

The validator must use structured fields, not human reason text:

1. Missing params -> `MALFORMED_URL`
2. Batch not found -> `UNKNOWN_BATCH`
3. Duplicate BID rows -> `SUN_BATCH_DUPLICATE_CONFIG`
4. Batch revoked -> `INVALID`
5. SUN crypto fails before UID -> `SUN_PROFILE_MISMATCH`
6. UID decoded but not in manifest -> `NOT_REGISTERED`
7. UID decoded but inactive -> `NOT_ACTIVE`
8. Replayed URL -> `REPLAY_SUSPECT`
9. Valid `ntag424_dna` without TT hardware -> `VALID_AUTHENTIC`
10. Valid `ntag424_dna_tt` plus `tt_raw = 4343` -> `VALID_CLOSED`
11. Valid `ntag424_dna_tt` plus `tt_raw = 4F4F` -> `VALID_OPENED`
12. Valid `ntag424_dna_tt` plus `tt_raw = 4F43` -> `VALID_OPENED_PREVIOUSLY`
13. Cryptographically valid `ntag424_dna_tt` with TTStatus missing or
    non-canonical -> `SUN_PROFILE_MISMATCH` at the durable boundary.

`VALID_UNKNOWN_TAMPER` is retained only as legacy/intermediate diagnostic
vocabulary; it must not become a final authenticity or opening assertion for a
production TT profile.

Neither `encPlainStatusByte` nor query parameters such as `tamper`, `opened` or
`tt_status` are trust inputs. Electronic opening state comes only from the full
two-byte TTStatus decoded from the configured encrypted payload; an explicit
manual state must come from the privileged audited override path.

If UID is null, the problem is SUN crypto/layout, not manifest.

## BID uniqueness

`bid` is globally unique because `/sun` receives only `bid`, `picc_data`, `enc`, and `cmac`. The backend must never use `LIMIT 1` to silently choose between duplicate rows.

Admin diagnostic:

`GET /admin/batches/by-bid/:bid/debug`

Returns every row for that BID, key fingerprints only, tag counts, tenant, status, and the summarized `sdm_config`. It never returns raw keys.
