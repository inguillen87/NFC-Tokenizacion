# Supplier static-carrier QA v1

## Scope

This contract covers **trial-integration and production** factory QA for
keyless carriers that do not produce NTAG 424 SUN/SDM evidence:

| Carrier | Required capture | What NexID verifies | What NexID does not claim |
| --- | --- | --- | --- |
| `qr_basic` | `qr_camera` | Imported UID and exact NexID QR target | Cryptographic tag authentication, anti-replay, tamper, physical presence |
| `ntag213`, `ntag215`, `ntag216` | `nfc_ndef` | Imported UID and exact static NDEF target | SUN/CMAC, anti-replay, tamper, physical presence |
| `gs1_digital_link` | `qr_camera` | Imported UID, exact Digital Link and active tenant/batch/tag GS1 registry binding | Cryptographic tag authentication, anti-replay, tamper, physical presence |
| `uhf_rfid` | `uhf_reader` | Imported UID and exact tenant/BID-scoped RFID target | NFC/SUN, anti-replay, tamper, physical presence |
| `event_wristband`, `hotel_keycard` | `nfc_ndef` | Imported UID and exact carrier-specific target | SUN/CMAC, anti-replay, tamper, physical presence |
| `iot_tracker_placeholder` | `device_telemetry` | Imported device UID and exact telemetry identity target | Hardware attestation, secure-element custody, anti-replay, physical presence |

`ntag424_dna` and `ntag424_dna_tt` remain on the existing physical SUN path.
No carrier may fall back to a checkbox or a SUN-shaped envelope. Adding a new
carrier still fails closed until its capture method and exact target adapter are
explicitly implemented and reviewed.

## Request

`POST /admin/supplier-orders/{orderId}/qa` still requires admin authorization,
tenant scope, `supplier:qa` (or the legacy batch QA permission), and an
`Idempotency-Key` header. For a supported static carrier, a passing request uses:

```json
{
  "bid": "SYN-2026-001",
  "status": "passed",
  "carrier_observations": [
    {
      "uid_hex": "04AABBCCDD1122",
      "encoded_url": "https://nexid.lat/sun?channel=static_nfc&carrier=ntag213&tenant=syngenta&bid=SYN-2026-001&uid=04AABBCCDD1122",
      "captured_at": "2026-08-02T17:00:00.000Z",
      "capture_method": "nfc_ndef"
    }
  ]
}
```

For trial integration, the sample size is exactly
`min(10, expected_quantity)`. For production, the backend takes the exact sample
size from the current tenant-approved production QA plan; it does not trust a
sample size supplied by the browser. All UIDs must be distinct and imported in
the selected batch, and captures must be after manifest import and within the
last 72 hours. URLs must use the configured allowlisted HTTPS public origin and
match the carrier-specific canonical target exactly. Supplying SUN snapshot
references together with static-carrier observations is rejected as an
evidence-mode conflict.

## Durable evidence

Migrations `20260802200000_0085_supplier_non_sun_qa_evidence.sql` and
`20260802260000_0091_supplier_keyless_qa_activation.sql` provide append-only
receipts and a single transactional writer. The database independently re-locks
tenant, authenticated session, supplier order, sub-batch, batch, manifest,
selected tags, current QA plan/approval when production, Packaging Lab receipt
and GS1 identities before it writes the QA check, immutable verification-context
receipt, carrier receipts, keyless production-acceptance receipt, vault metadata,
evidence event, audit row and state transitions.

The database also proves the keyless custody boundary: zero `batch_keys`, zero
`batch_key_material`, no legacy encrypted batch key columns, no key fingerprint,
and explicit `key_material_mode=none`, `managed_kms=false`, `hsm_backed=false`.
It never manufactures sentinel keys to satisfy a SUN-shaped schema.

Durable evidence contains batch-scoped UID fingerprints, URL hashes and semantic
target-binding digests. It does not persist raw UIDs or raw encoded URLs in the
QA evidence envelope or carrier receipt table. Every projection explicitly records:

- `server_verified_sun_evidence: false`
- `cryptographic_authentication_verified: false`
- `anti_replay_verified: false`
- `ttstatus_verified: false`
- `physical_ceremony_verified: false`

These SHA-256 commitments are application/database integrity bindings. They are
not signatures, KMS operations, HSM attestations or proof that an operator was
physically present.

## Production boundary

Trial-integration evidence remains `NON_SELLABLE` and keeps
`activation_allowed: false`. A passing production receipt requires the exact
current tenant-approved sampling plan plus a current carrier-appropriate
Packaging Lab activation receipt. It moves the lot only to
`BLOCKED_PENDING_ACTIVATION`; a separate database-atomic activation dispatcher
must revalidate that receipt and the complete tenant/order/sub-batch/batch/BID/
carrier scope before activation.

The secure SUN production route and its original activation receipt remain
unchanged for `ntag424_dna` and `ntag424_dna_tt`. Keyless evidence never claims
CMAC, anti-replay, tamper, KMS or HSM assurance.
