# Supplier Encoding Pack and Tenant Vault

This document defines what nexID sends to a physical tag supplier, what stays inside nexID custody, and how the tenant-facing vault should be described.

## Product rule

The factory receives only the materials required to encode a specific sub-batch:

- `tenant_ref` or public tenant label.
- `order_id` and `batch_id`.
- `sub_batch_id` / `bid`.
- Chip model and SDM/TagTamper profile.
- Per-sub-batch encoding keys, delivered only through the encrypted pack.
- URL template or route template, redacted in public copy.
- Manifest return format.
- QA sample count and acceptance criteria.

The factory never receives:

- Master keys.
- Database URLs.
- Vercel, database, admin, GitHub or cloud tokens.
- Polygon minter private keys.
- Executor secrets.
- Consumer PII.
- Tenant commercial contracts, margins or private routes.

Use generic labels such as "sub-batch encoding keys" in public and tenant-facing copy. The actual key field names and values belong only in the encrypted supplier pack and secure backend logs; the supplier should not see KMS terminology or database implementation details.

## Why sub-batches matter

A supplier order can contain several sub-batches because production can be split by SKU, artwork, roll, carton, region, chip profile or QA window.

Each sub-batch must have its own encoding scope:

| Scope | Purpose |
| --- | --- |
| `order_id` | Commercial/operational order across one supplier run |
| `batch_id` | Tenant product batch or campaign |
| `sub_batch_id` / `bid` | Exact encoding scope used by the validation service |
| sub-batch encoding keys | AES-128 keys for that sub-batch, redacted in public docs |
| manifest | UID allowlist returned by supplier for that sub-batch |

Do not reuse one supplier key pack across unrelated tenants, products, cartons or supplier runs. If physical production is split, the encoding pack should make that split explicit.

## Supplier Encoding Pack

The pack should be encrypted for transfer and treated as one-time operational material. A conceptual pack:

```json
{
  "pack_version": "nexid-supplier-pack-v1",
  "tenant_ref": "tenant_public_ref",
  "order_id": "SUP-2026-00041",
  "batch_id": "NXD2606-A01",
  "sub_batch_id": "NXD2606-A01-R001",
  "bid": "NXD2606-A01-R001",
  "chip_model": "NTAG 424 DNA TagTamper",
  "sdm_profile": {
    "mac_input": "enc_plus_cmac_literal",
    "ttstatus_enabled": true,
    "ttstatus_source": "enc_decrypted",
    "ttstatus_offset": 0,
    "ttstatus_length": 2
  },
  "keys": "<REDACTED_SECURE_CHANNEL>",
  "url_template": "<VALIDATION_URL_TEMPLATE_REDACTED>",
  "manifest_format": "sub_batch_id,bid,uid_hex,ic_type,roll_id,qc_status,timestamp",
  "qa": {
    "sample_count": 12,
    "must_pass": ["uid_decode", "cmac_valid", "replay_blocked", "ttstatus_closed"]
  }
}
```

Recommended transport controls:

- Export only from an authenticated backend operations flow, not from a public browser form.
- Encrypt the ZIP or JSON before sending.
- Share the archive and password/key through separate channels.
- Record export time, exporter, supplier recipient and pack fingerprint.
- Expire or rotate the pack after delivery, incident or production drift.

## Supplier manifest return

The supplier returns stock/allowlist data, not authenticity proof.

```csv
sub_batch_id,bid,uid_hex,ic_type,roll_id,qc_status,timestamp
NXD2606-A01-R001,NXD2606-A01-R001,04AABBCCDDEEFF,NTAG424DNA_TT,R001,PASS,2026-06-27T00:00:00Z
```

The backend must validate:

- `bid` exists and is unique.
- Manifest rows belong to the expected tenant/order/sub-batch.
- UID format is valid and not duplicated in the wrong scope.
- Sample tags decode with the expected sub-batch encoding keys and SDM profile.
- Replay checks fail as expected when a URL is reused.
- TagTamper values match the configured profile when supported.

If UID decode fails, inspect key/profile/layout first. The manifest cannot fix wrong sub-batch keys, changed PICCData layout or supplier programming drift.

## Tenant Vault

Tenant Vault is the tenant-visible evidence layer for supplier operations. It is not a secret manager UI.

Tenant Vault can show:

- Supplier order status.
- Sub-batch list and counts.
- Pack fingerprint and export audit.
- Manifest import status.
- Manifest hash or sanitized Merkle root.
- QA PDF/JSON reports.
- ZIP artifact metadata.
- Batch activation and DPP event references.
- Optional IOTA proof status for selected evidence.

Tenant Vault must not show:

- Raw sub-batch encoding keys after export.
- Master keys.
- Database URLs.
- Internal storage paths that reveal infrastructure.
- Private keys, admin tokens or executor secrets.
- Consumer PII.

## Hash and Merkle policy

Use hashes to prove that a file or event set has not changed without publishing the file itself.

- For one artifact, canonicalize the artifact metadata and calculate `sha256`.
- For many rows/events, calculate one digest per row/event, build a Merkle tree and store only the Merkle root as the public checkpoint.
- Keep the full manifest, QA evidence and event details in backend storage with tenant access control.
- If IOTA is enabled, anchor only the sanitized digest, Merkle root or proof envelope.
- If Polygon is enabled, use it for ownership, claim, NFT/certificate and transfer state, not supplier manifest evidence.

Example:

```txt
manifest rows -> canonical row digests -> Merkle root -> Tenant Vault evidence -> optional IOTA proof
valid claim -> policy approval -> Polygon mint/transfer -> tx_hash/token_id
```

## Approved language

- "The supplier receives sub-batch encoding keys through an encrypted pack for the authorized scope only."
- "Tenant Vault exposes evidence, hashes, manifests and QA status, not infrastructure secrets."
- "Polygon is used for ownership, NFT/certificate, claim and transfer events."
- "IOTA can be enabled as an optional proof layer for hashes, Merkle roots, DPP and logistics evidence."
- "nexID does not write every tap on-chain."

## Language to avoid

- "The supplier receives KMS access."
- "Send database URLs to the factory."
- "Every tap is anchored on-chain."
- "Formal Polygon/IOTA alliance" unless there is a public signed agreement.
- "Free network/RPC/custody proof."
