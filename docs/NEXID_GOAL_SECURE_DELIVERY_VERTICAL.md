# /goal NEXID SECURE DELIVERY VERTICAL

Build a premium logistics/courier verified-delivery module for nexID.

## Strategic rule

This is not cheap package tracking. This is a premium chain-of-custody and tamper-evidence layer for high-value, regulated, sensitive or fraud-prone deliveries.

## Do not break

- Existing `/sun` flow
- Existing NFC/SUN/SDM validation
- Existing DPP/mobile passport
- Existing Polygon ownership flows
- Existing supplier batch/key workflows

## Do not claim

- Passive NFC gives GPS or real-time tracking
- QR/basic NFC proves cryptographic authenticity
- Seal-closed unless TTStatus/operator evidence confirms it
- Every event goes on-chain

## New entities

- `shipments`
- `shipment_items`
- `package_seals`
- `seal_inventory`
- `custody_events`
- `recipient_verifications`
- `delivery_claims`
- `carrier_integrations`

## Seal lifecycle

```text
UNASSIGNED -> ASSIGNED -> SEALED -> IN_TRANSIT -> DELIVERED_CLOSED
                                              -> DELIVERED_OPENED
                                              -> QUARANTINED
                                              -> VOIDED
```

## Required flows

1. Create logistics/carrier tenant.
2. Import or generate secure seal batch.
3. Maintain unassigned pool of pre-encoded labels.
4. Warehouse operator scans order and assigns seal UID to shipment.
5. Operator captures photo/evidence at sealing time.
6. Carrier handoff scans update chain of custody.
7. Recipient scans on delivery.
8. If NTAG 424 DNA TT: read `ttRaw` and detect `VALID_CLOSED`, `VALID_OPENED`, `VALID_OPENED_PREVIOUSLY`.
9. If QR/basic NFC: show lower-trust identity state, not cryptographic authenticity.
10. If opened/mismatch/replay: create delivery claim.
11. Webhooks: `seal.applied`, `shipment.handoff`, `delivery.verified`, `tamper.reported`.
12. Proof Layer: anchor daily claim/QA/report hashes in IOTA; use Polygon only for ownership/certificates if needed.

## Mobile recipient UX

States:

- `DELIVERED_CLOSED`: "Tu paquete llego sellado."
- `DELIVERED_OPENED`: "El sello aparece abierto. Crear reclamo."
- `REPLAY_SUSPECT`: "Lectura reutilizada. Escanea fisicamente el sello."
- `SUN_PROFILE_MISMATCH`: "No pudimos validar esta lectura."
- `BASIC_IDENTITY_ONLY`: "Identidad encontrada. Sin verificacion criptografica."

## Acceptance criteria

- A random product can receive a pre-encoded unassigned seal and become a verified shipment.
- Recipient mobile page is product/shipment-first.
- No product authentic claim if SUN crypto fails.
- No seal-closed claim without TTStatus or operator evidence.
- Works for 1,000-package pilot with CSV import/export.
- Tenant sees safe data only; superadmin sees supplier/key operations.
- No raw keys in frontend, logs or public files.
- Builds pass.
