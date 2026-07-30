# Supplier SUN QA evidence gate — 2026-07-29

## Executive verdict

NexID now has a local, server-derived QA gate for NTAG 424 DNA and NTAG 424 DNA TagTamper supplier batches. An operator can no longer approve a sub-batch by checking boxes or pasting a plausible raw SUN URL. A pass requires persisted NexID result references, cryptographic SUN evidence, canonical event linkage and replay evidence for ten distinct manifest UIDs. TagTamper additionally requires an electronically decoded closed state for every sampled UID and a later opened state for one revoked sacrificial UID.

This is locally implemented and tested code. It is not evidence of a physical factory trial, production deployment, physical NFC presence, packaging performance, custody or statistical acceptance of a production lot.

The physical NTAG 424 cryptographic path remains authoritative. The gate consumes its persisted results; it does not replace CMAC, SDM, counter or TagTamper verification. Application envelope encryption backed by deployment secrets remains software custody and is not KMS or HSM.

## What the backend proves

For every submitted `snapshot + trace` reference, the server requires:

- a `sun_diagnostics` row created by the public `/sun` route, after manifest import and inside a 72-hour evidence window;
- exact tenant, batch, BID, UID and read-counter agreement among the diagnostic, raw SUN result and canonical event;
- an exact manifest UID match;
- `side_effect_mode=persist`, `verification_method=sun_crypto`, valid CMAC, successful SDM decryption and decoded UID;
- a canonical `events` row with `source=real`, `cmac_ok=true`, the same result and a bounded event-to-diagnostic time difference;
- a replay event for the same UID and counter, later than the accepted event, with `meta.replay_original_event_id` pointing to that accepted event;
- for TagTamper, an electronic `VALID_CLOSED` sample for every selected UID and one later electronic `VALID_OPENED` transition with a higher counter;
- current lifecycle state `revoked` for the opened sacrificial tag, so it cannot remain sellable;
- a domain-separated, versioned application-level scan-time `verification_context_digest` (`nexid:supplier-qa:verification-context`, `v2`) over tenant, batch, normalized BID, manifest hash, carrier profile, authoritative pair fingerprint, SDM configuration, supplier order/sub-batch identity and state, one-time pack/key export receipts, the effective immutable `pack_purpose`, acceptance scope, and the approved packaging revision/hash. `/sun` and QA use one canonical builder; QA recomputes the same context from authoritative rows and rejects any mismatch.

That context digest is an unkeyed SHA-256 consistency binding stored in the same operational database. It is not a digital signature, independent timestamp, WORM record, KMS operation or HSM attestation, and it does not prove resistance to privileged database rewriting. A manifest, key, carrier/SDM configuration, export receipt, purpose decision or packaging-revision change invalidates earlier diagnostics for QA and requires a fresh ceremony.

Pre-activation scans are supported deliberately. A cryptographically verified tag whose administrative state is `inactive` may return `NOT_ACTIVE` while its electronic product state remains closed. That tag can qualify for factory QA without being activated for market use.

The QA receipt stores diagnostic/event identifiers, reference hashes, counters, product states and batch-scoped UID fingerprints. It does not duplicate raw SUN query values or raw UID values into the QA/Vault report. Operational manifest and diagnostic storage still contains tenant-restricted UIDs; the fingerprints are pseudonymous, not anonymous.

## What the backend does not prove

`server_verified_sun_evidence=true` means the backend independently verified the persisted cryptographic and event evidence. The receipt intentionally retains:

```json
{
  "physical_ceremony_required": true,
  "physical_ceremony_verified": false
}
```

The evidence cannot, by itself, prove:

- that a person was physically beside the tag;
- who performed a tap;
- custody, purchase, route, package contents or product provenance;
- RF performance on a filled bidon or seed bag;
- adhesive, chemical, temperature, moisture or applicator-line performance;
- that ten operator-selected tags statistically represent a large production lot.

A captured URL can be replayed without new NFC contact. That is useful for the anti-replay test, but it is also why a public-route marker must never be marketed as physical attestation.

The fixed ten-tag ceremony is an integration/trial qualification only. It is not a receiving-inspection or statistical lot-acceptance plan for 5,000, 10,000 or 100,000 tags. Production acceptance needs a customer-approved sampling plan and server-selected samples as described below.

## Current 10-tag ceremony

Use one tenant, supplier, SKU/package construction, carrier profile, immutable packaging revision, BID and key fingerprint per trial. Do not mix a liquid-cap construction and a seed-bag construction in the same trial.

1. Import the exact factory manifest without activating any tag.
2. Confirm that all trial UIDs are unique, belong to the expected BID and remain non-sellable/inactive.
3. Tap the first tag through the canonical `/sun` path and privately retain the original dynamic SUN URL.
4. Copy the NexID result-page URL containing `snapshot` and `trace`.
5. Reopen the exact original dynamic SUN URL without tapping again. This must create `REPLAY_SUSPECT` linked to the original canonical event and the same counter.
6. Copy the replay result-page `snapshot + trace` URL.
7. Repeat steps 3–6 for ten distinct manifest UIDs. Non-TT requires 20 result references.
8. For TagTamper, confirm that all ten initial samples decode electronic `VALID_CLOSED`.
9. Break the real opening bridge on one designated sacrificial tag, tap it again and require a later electronic `VALID_OPENED` product state with a greater counter.
10. Revoke that UID through the governed lifecycle API, then add its opened result reference. TT requires 21 result references.
11. Submit the references from Supplier Ops. Do not submit raw `picc_data`, `enc`, `cmac`, UID or keys.
12. Preserve the external physical protocol, photos and factory/line receipts separately in tenant-restricted evidence storage. They are not inferred from the SUN receipt.

If the customer needs ten usable TT samples after QA, order or encode at least eleven. When exactly ten are encoded, one becomes destroyed/revoked and only nine remain unopened; none of the trial units should be counted as production inventory.

## Failure behavior

The gate fails closed when:

- a raw SUN URL is supplied instead of a result reference;
- a reference uses remote HTTP, an invalid trace, an invalid snapshot identifier or exceeds bounds;
- fewer than ten distinct manifest UIDs qualify;
- evidence is stale, predates the manifest, comes from demo/inspect or belongs to another tenant/batch/BID;
- UID/counter/result differs between raw result, diagnostic and canonical event;
- CMAC/SDM/UID decoding is incomplete;
- a replay lacks the exact original-event link, same counter or later event ordering;
- TagTamper evidence is manual, missing, stale or not electronically decoded;
- the sacrificial opened tag has not been revoked;
- the order and batch carrier profiles disagree;
- the scan-time verification context is absent or no longer matches the authoritative manifest, key fingerprint, carrier/SDM configuration, export receipts, supplier state or packaging revision;
- packaging governance lacks the exact approved decision receipt, the manifest count differs from the expected lot quantity, or the pack/key export counters are not exactly one;
- QA has already passed or the sub-batch has been activated;
- the carrier is not an implemented SUN strategy.

An operator rejection records a negative receipt only. It does not create positive SUN evidence.

Migration `0070` moves the positive/negative QA receipt, unique diagnostic claims, Vault metadata, sub-batch/batch transition, evidence event and audit projection into one row-locked, idempotent PostgreSQL function. The HTTP endpoint requires an `Idempotency-Key`; an exact retry returns the original receipt, while a changed payload or reused diagnostic fails closed. The receipt and consumption rows are append-only. This is locally implemented contract evidence, not proof that migration `0070` is applied or that its concurrency behavior has passed a deployed database smoke test.

## Target manufacturing state machine

The current order/export model still creates production-shaped batches and keys too early and requires final packaging evidence before any export. That produces a circular dependency for a factory that needs a small encoding pack to create the very trial evidence required for approval. The target model is:

```text
DRAFT_SPEC
  -> TRIAL_PACK_APPROVED
  -> TRIAL_10_ENCODED
  -> TRIAL_QA_PASSED
  -> PRODUCTION_PROVISIONED
  -> PRODUCTION_PACK_RELEASED
  -> PRODUCTION_MANIFEST_IMPORTED
  -> RECEIVING_QA_PASSED
  -> ACTIVATED
```

### `DRAFT_SPEC`

Persist tenant, supplier, SKU/package use case, carrier, construction, substrate, antenna/label geometry, adhesive, roll geometry, line speed/unwind, environment and TT opening path. Persist an immutable revision and SHA-256 digest. No factory export and, in the target model, no production keys yet.

### `TRIAL_PACK_APPROVED`

An independent reviewer approves a bounded trial, not production readiness. Generate a dedicated `purpose=trial`, non-sellable BID/key pair with quantity, expiry, spec hash, carrier config and intended supplier recipient. Export once as an encrypted artifact and record digest, exporter, recipient, delivery/acknowledgement and separate-channel password handling. Never call this HSM or managed KMS custody.

### `TRIAL_10_ENCODED`

The factory returns the exact trial manifest and encoding/read-back receipt. Require unique UIDs, exact quantity, tenant/order/BID/chip/roll binding, manifest hash and matching pack/config/key fingerprints. Pre-designate the TT sacrificial unit.

### `TRIAL_QA_PASSED`

Apply the ceremony above. A future QA session must select the sample UIDs server-side, bind an expiry/challenge and prevent operator cherry-picking.

### `PRODUCTION_PROVISIONED`

Only after trial QA and immutable production packaging approval, generate new production BIDs and new production key pairs. Trial keys are never promoted or reused. Required physical artifacts include measured RF samples on the actual filled package, line trial, adhesive/environment protocol, artwork/dieline, encoding read-back and TT placement across the real opening path.

### `PRODUCTION_PACK_RELEASED`

Revalidate the exact approved snapshot at the custody boundary and atomically persist the one-time encrypted pack, selected sub-batches, recipient, exporter, expiry, delivery state and counters. Release authorizes factory encoding only; it does not activate tags.

### `PRODUCTION_MANIFEST_IMPORTED`

Freeze the complete production manifest and require exact expected quantity, BID, carrier, packaging revision, key-pair fingerprint, pack receipt and factory read-back provenance. A changed manifest or manufacturing context creates a new revision and invalidates prior QA evidence; it is never edited underneath a passed receipt.

### `RECEIVING_QA_PASSED`

Create an expiring server-owned QA session after the manifest is frozen. The server, not the operator, selects the sample across roll/carton/pallet strata and commits the selection seed before results are entered. Record the customer quality team's approved lot size, inspection level, target AQL, sample size, accept/reject numbers, observed defects and disposition. The ten-tag ceremony can be one cryptographic integration check inside this plan, but cannot substitute for it.

### `ACTIVATED`

Activation references the exact passed receiving-QA receipt and current revision. Any corrective reopening, quarantine or exception is a separate append-only workflow with explicit authority; no operator edits a historical pass in place.

## Remaining P0 controls

1. Persist `manufacturing_state` and `pack_purpose=trial|production` rather than inferring state from legacy strings.
2. Split order/spec creation from key generation and add a bounded trial-export gate.
3. Give trial and production distinct BIDs and keys; never promote trial key material.
4. Add an expiring QA session/challenge with server-selected UIDs and a customer-quality-approved AQL/stratified receiving policy for production. Persist lot size, inspection level, target AQL, sample size, accept/reject numbers and the selection seed/commitment; do not invent Syngenta's AQL.
5. Validate migration `0070` on a disposable PostgreSQL database with concurrent double-pass, pass-versus-activation, diagnostic-reuse, exact retry and forced late-failure rollback tests, then run staging/deployed smoke before claiming the boundary operational.
6. Prove the stored pair fingerprint comes from the actually decrypted key pair and copy the versioned digest to a normalized/canonical evidence plane. The local domain-separated scan-time binding exists, but it is not an independent attestation.
7. Persist manufacturing state and the future QA-session commitment in the scan-time context. Effective `pack_purpose` is now bound by the shared v2 builder; manufacturing state and a server-owned QA-session commitment remain absent.
8. Resolve RF/line/adhesive/artwork/TT evidence through immutable tenant-owned Vault artifacts rather than free-form strings.
9. Finish a separate fail-closed QA strategy for QR/UHF/non-SUN carriers.
10. Run the real tags through production-like staging and record physical outcomes; local fixtures do not satisfy this gate.

## Local verification

The focused local commands are:

```powershell
npm.cmd -w api run test:supplier-security
npm.cmd -w api run test:sun
node --test apps/dashboard/tests/supplier-order-public-copy.test.mjs
.\node_modules\.bin\tsc.cmd -p apps/api/tsconfig.json --noEmit --incremental false
.\node_modules\.bin\tsc.cmd -p apps/dashboard/tsconfig.json --noEmit --incremental false
git diff --check
```

These checks validate code and contracts only. Before any production claim, require migration rollout evidence, deployed runtime smoke tests and the physical ceremony on the real carrier/package construction.
