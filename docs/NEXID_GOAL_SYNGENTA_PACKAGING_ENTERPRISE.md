# /goal NEXID SYNGENTA PACKAGING PILOT + ENTERPRISE HARDENING

Build and verify the production-grade nexID capabilities required to execute an enterprise packaging validation and a 5,000-unit secure product pilot without manual key mistakes, ambiguous carrier behavior, unsafe activation, broken integrations, or consumer-facing trust errors.

This goal is implementation work, not brainstorming.

Use the current repository state as source of truth.
Inspect before changing.
Reuse working modules.
Do not rebuild working SUN/SDM or Polygon flows without a proven defect.

Return only:

1. exact changed files;
2. DB migrations;
3. new routes/endpoints;
4. new UI pages/components;
5. screenshots;
6. build/test output;
7. proven blockers with file and reason.

---

## 0. Business and technical context

nexID is preparing enterprise pilots for organizations such as Syngenta, wineries, pharma, cosmetics, logistics operators, premium brands and packaging/printing partners.

The immediate enterprise use case is:

```text
physical product
-> packaging-integrated NFC / QR / RFID identity
-> cryptographic or declared identity validation
-> Digital Product Passport
-> anti-fraud and channel events
-> stewardship / content / CRM / loyalty
-> API or webhook integration
-> optional Polygon ownership
-> optional IOTA proof/audit layer
```

The first Syngenta pilot must be packaging-first.

Recommended carrier strategy:

```text
Seed bags / bulk bags:
NTAG 424 DNA without tail
transparent PET wet inlay in roll
integrated under or inside current label
QR / GS1 Digital Link visible fallback

Standard jerry cans / bidons:
NTAG 424 DNA without tail in body label

Critical opening / anti-refill:
NTAG 424 DNA TagTamper only when tail physically crosses cap and body

Boxes / pallets:
GS1 / QR + UHF RFID

Transport / sensors:
IoT module later, not passive NFC
```

The application must support these carrier roles without confusing them.

---

# 1. Non-negotiable rules

## Do not break

- `/health`
- `/sun`
- valid SUN/SDM authentication
- CMAC verification
- replay detection
- UID extraction
- read-counter extraction
- existing Polygon ownership/tokenization
- existing tenant authentication
- existing production routes

## Do not expose

- application envelope KEK `KMS_MASTER_KEY_HEX`;
- versioned NFC envelope KEKs `NFC_ENVELOPE_KEK_*_HEX`;
- raw `K_META_BATCH`
- raw `K_FILE_BATCH`
- Polygon private keys
- IOTA private keys
- API secrets
- webhook secrets
- authorization headers
- cookies
- database credentials

Raw batch keys may appear only inside an explicit, privileged, one-time supplier export.

## Do not hardcode

- Syngenta as production logic
- `DEMO-2026-02` as architecture
- demo UIDs as hidden fallback
- real dynamic `/sun` URLs
- production keys
- localhost fallback in production

## Do not claim

- QR is cryptographic authentication;
- NTAG213/215/216 are secure anti-counterfeit tags;
- NTAG424 without tail has opening status;
- consumer offline mode provides final SUN/SDM authenticity without backend verification;
- every tap belongs on-chain;
- IOTA has zero fees;
- nexID is an official Polygon or IOTA partner unless explicitly approved and configured.

---

# 2. Multi-agent execution plan

Use parallel agents where safe, but Agent 0 controls sequencing and final acceptance.

Recommended workstreams:

```text
Agent 0  - Orchestrator and acceptance controller
Agent 1  - Carrier profiles and packaging data model
Agent 2  - Supplier orders, sub-batches, application-envelope custody and supplier packs
Agent 3  - Packaging Lab and QA workflow
Agent 4  - SUN/SDM, TTStatus and trust-state guardrails
Agent 5  - Agro DPP and mobile post-tap experience
Agent 6  - GS1 Digital Link resolver and QR fallback
Agent 7  - Enterprise APIs, Cropwise-ready events and webhooks
Agent 8  - Anti-fraud, analytics, channel and CRM/loyalty
Agent 9  - Offline and low-connectivity modes
Agent 10 - Polygon ownership and IOTA proof-layer separation
Agent 11 - Enterprise security, RBAC, audit and secrets
Agent 12 - CI, automated tests and regression evidence
```

Agent 0 must reject unsafe shortcuts and merge only after acceptance tests pass.

---

# AGENT 0 - Orchestrator and acceptance controller

## Responsibilities

- inventory existing functionality before implementation;
- map each requirement to existing, partial or missing code;
- assign ownership to agents;
- prevent overlapping schema migrations;
- preserve API compatibility;
- execute final integration tests;
- produce a gap report and delivery report.

## Required pre-implementation audit

Search for:

```text
carrier_profile_code
ntag424_dna
ntag424_dna_tt
ttstatus_enabled
encPlainStatusByte
VALID_UNKNOWN_TAMPER
VALID_AUTHENTIC
SUN_PROFILE_MISMATCH
supplier order
manifest import
K_META
K_FILE
encryptKey16
decryptKey16
webhook delivery
GS1
Polygon
IOTA
proof_events
audit_log
tenant_id
```

Classify each requirement:

```text
IMPLEMENTED
PARTIAL
MISSING
UNSAFE
DUPLICATED
DEPRECATED
```

## Global acceptance commands

```bash
npm -w api run build
npm -w web run build
npm -w dashboard run build
npm -w api run test:sun
```

Run all existing unit/integration/e2e tests.

---

# AGENT 1 - Carrier profiles and packaging data model

## Goal

Make packaging and carrier behavior explicit, data-driven and tenant-safe.

## Required carrier profiles

```text
gs1_qr
ntag213
ntag215
ntag216
ntag424_dna
ntag424_dna_tt
uhf_rfid
event_wristband
hotel_keycard
iot_tracker_placeholder
```

## Carrier profile model

Create or normalize:

```ts
CarrierProfile {
  code: string
  display_name: string
  technology: "QR" | "NFC" | "UHF" | "IOT"
  chip_model?: string
  cryptographic_authentication: boolean
  supports_dynamic_uid: boolean
  supports_read_counter: boolean
  supports_cmac: boolean
  supports_replay_detection: boolean
  supports_tamper: boolean
  supports_bulk_read: boolean
  requires_reader: boolean
  requires_batch_keys: boolean
  trust_level: string
  allowed_product_states: string[]
  description_consumer: string
  description_operator: string
  active: boolean
}
```

## Packaging construction model

Create:

```ts
PackagingCarrierSpec {
  id: string
  tenant_id: string
  carrier_profile_code: string
  delivery_format: "dry_inlay" | "wet_inlay" | "white_label" | "transparent_pet" | "void_label" | "hard_tag"
  antenna_width_mm?: number
  antenna_height_mm?: number
  die_cut_width_mm?: number
  die_cut_height_mm?: number
  total_thickness_mm?: number
  adhesive_code?: string
  adhesive_description?: string
  liner_type?: string
  roll_core_mm?: number
  pitch_mm?: number
  web_width_mm?: number
  unwind_direction?: string
  target_substrates: string[]
  forbidden_conditions: string[]
  metal_clearance_mm?: number
  operating_temperature?: object
  humidity_test_required: boolean
  chemical_test_required: boolean
  abrasion_test_required: boolean
  notes?: string
}
```

## Packaging placement model

```ts
PackagingPlacement {
  id: string
  tenant_id: string
  product_id?: string
  sku?: string
  packaging_type: "seed_bag" | "woven_bag" | "laminated_bag" | "jerry_can" | "cap" | "box" | "pallet" | "other"
  carrier_spec_id: string
  placement_zone: string
  placement_image_url?: string
  crosses_opening: boolean
  requires_tail_break: boolean
  validated: boolean
  validation_report_id?: string
}
```

## Rules

- `ntag424_dna` must never expose or infer tamper state.
- `ntag424_dna_tt` may expose tamper only from validated 2-byte TTStatus or explicit manual evidence.
- `gs1_qr` must be marked as declared identity, not cryptographic authenticity.
- `uhf_rfid` must not use SUN keys.
- carrier behavior must come from profile/config, not `if bid === DEMO...`.

## Acceptance

- admin can create/select packaging construction;
- carrier profile drives UI copy and validation behavior;
- a non-TT 424 tag returns `VALID_AUTHENTIC`, not `VALID_UNKNOWN_TAMPER`;
- all records are tenant-scoped.

---

# AGENT 2 - Supplier orders, sub-batches, application-envelope custody and supplier packs

## Goal

Make production of 5,000+ tags deterministic and resistant to human error.

## Supplier order model

```ts
SupplierOrder {
  id: string
  tenant_id: string
  order_code: string
  customer_slug: string
  order_name: string
  supplier_name: string
  total_quantity: number
  sub_batch_size: number
  carrier_profile_code: string
  packaging_carrier_spec_id: string
  status: "DRAFT" | "PLANNED" | "KEYS_GENERATED" | "PACK_EXPORTED" | "SENT_TO_SUPPLIER" | "MANIFEST_RECEIVED" | "QA_PENDING" | "QA_PASSED" | "ACTIVE" | "QUARANTINED" | "CANCELLED"
  created_by: string
  created_at: Date
}
```

```ts
SupplierSubBatch {
  id: string
  supplier_order_id: string
  tenant_id: string
  batch_id: string
  sequence: string
  expected_quantity: number
  imported_quantity: number
  active_quantity: number
  meta_key_reference?: string
  file_key_reference?: string
  key_version?: number
  sdm_config: object
  qa_status: string
  status: string
}
```

## Required 5K behavior

Creating:

```text
total_quantity = 5000
sub_batch_size = 1000
```

must generate five sub-batches with globally unique BIDs.

Example only:

```text
SYN-AR-2026-001-A
SYN-AR-2026-001-B
SYN-AR-2026-001-C
SYN-AR-2026-001-D
SYN-AR-2026-001-E
```

Do not hardcode this example.

## Key generation

For secure NFC profiles only:

```text
K_META_BATCH = cryptographically random 16 bytes / 32 hex
K_FILE_BATCH = cryptographically random 16 bytes / 32 hex
```

Rules:

- one unique pair per sub-batch;
- encrypt at rest with the existing AES-256-GCM application envelope;
- store fingerprint, version, created_by and export audit;
- never store plaintext in repo, frontend or logs;
- the application envelope KEK (`KMS_MASTER_KEY_HEX`) and versioned NFC
  envelope KEKs never leave the backend;
- no key reuse across customers or sub-batches.

## Tenant Vault

Build a logical vault:

```text
/{tenant_slug}
  /supplier-orders/{order_code}
    /sub-batches
    /secure-exports
    /manifests
    /qa-reports
    /proofs
```

This is metadata + protected object storage, not a plaintext filesystem.

## Supplier encoding pack

Generate per sub-batch:

```text
README_FIRST.txt
supplier-pack.txt
supplier-pack.json
supplier-pack.pdf
manifest-template.csv
checksum.sha256
```

Secure profiles include:

```env
CLIENT_SLUG=
ORDER_CODE=
BATCH_ID=
QUANTITY=
CHIP_MODEL=
CARRIER_PROFILE=
K_META_BATCH=
K_FILE_BATCH=
URL_TEMPLATE=https://api.nexid.lat/sun?v=1&bid=<BATCH_ID>&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000
MANIFEST_FORMAT=batch_id,uid_hex
```

For `ntag424_dna_tt`, include:

```text
TTStatus source: encrypted ENC / SDMENCFileData
Offset: 0
Length: 2 bytes
4343 = CLOSED
4F4F = OPENED
4F43 = OPENED_PREVIOUSLY / permanent open + current closed
4949 = INVALID
```

Export rules:

- nexID AES-256-GCM JSON envelope (`.zip.enc`) that encrypts an internal ZIP;
- strong operator-generated password supplied to the request, never returned by
  the API, and delivered over a separate channel;
- checksum;
- privilege `supplier_pack.export`;
- download and export audit log;
- no tenant user has access by default; only `tenant_owner` or `super_admin`
  with `supplier_pack.export`, MFA and audit may generate a raw-key pack;
- no automatic email of raw keys;
- recommend separate channel for password.

## Acceptance

- 5K order creates five sub-batches and ten unique keys;
- supplier packs contain correct per-batch data;
- no application-envelope or NFC-envelope KEK in the export;
- no plaintext pack remains after export process;
- key fingerprints visible, raw keys hidden;
- duplicate BID blocked by DB constraint and application logic.

---

# AGENT 3 - Packaging Lab and QA workflow

## Goal

Create a formal Packaging Lab module before the field pilot.

## Packaging Lab model

```ts
PackagingLabProject {
  id: string
  tenant_id: string
  product_id?: string
  sku?: string
  packaging_type: string
  objective: string
  status: "DRAFT" | "MATERIALS_PENDING" | "TESTING" | "FAILED" | "APPROVED" | "ARCHIVED"
  owner_user_id: string
  created_at: Date
}
```

```ts
PackagingTestCase {
  id: string
  project_id: string
  category: "MATERIAL" | "ADHESION" | "RF" | "CRYPTO" | "LINE" | "ENVIRONMENT" | "UX"
  name: string
  method: string
  target: string
  result?: string
  status: "PENDING" | "PASS" | "FAIL" | "WAIVED"
  evidence_urls: string[]
  operator_id?: string
  tested_at?: Date
}
```

## Required test templates

### Seed bag / woven bag

- substrate identification;
- flat-zone placement;
- seam and crease avoidance;
- filled-bag reading;
- bending and wrinkling;
- abrasion;
- dust;
- humidity;
- label/inlay integration;
- mobile reading across selected devices;
- SUN/CMAC/manifest reconciliation.

### Jerry can / bidon

- HDPE/PE/PP substrate;
- filled vs empty container;
- body-label reading;
- cap geometry;
- condensation;
- chemical splash compatibility;
- curved-surface adhesion;
- TT tail crossing actual opening;
- closed scan;
- sacrificial opened scan;
- chip readability after opening.

### Roll and line

- roll core;
- web width;
- pitch;
- unwind direction;
- die-cut tolerance;
- sensor mark;
- application speed;
- reject handling;
- operator instructions;
- line interruption count.

## QA gate

A batch cannot become active unless:

```text
manifest valid
+ expected/imported quantity reconciled
+ Packaging Lab approved for that construction
+ secure sample validates
+ replay test passes
+ TT closed/open test passes when applicable
```

Superadmin override requires:

- explicit permission;
- mandatory reason;
- audit event;
- warning on tenant dashboard.

## Reports

Generate client-safe PDF/CSV report:

- material tested;
- placement;
- photos/evidence;
- devices;
- read success;
- crypto results;
- failures;
- recommendation;
- approved carrier and placement.

## Acceptance

- complete Packaging Lab without CLI;
- approval is linked to carrier spec + product/SKU;
- activation gate uses approval;
- report export works.

---

# AGENT 4 - SUN/SDM, TTStatus and trust-state guardrails

## Goal

Prevent false authenticity, false seal claims and profile drift.

## Exact decision order

```text
missing params -> MALFORMED_URL
unknown batch -> UNKNOWN_BATCH
duplicate batch -> SUN_BATCH_DUPLICATE_CONFIG
revoked batch -> INVALID
crypto fail before reliable UID -> SUN_PROFILE_MISMATCH
UID decoded but absent from manifest -> NOT_REGISTERED
UID decoded but inactive -> NOT_ACTIVE
replay -> REPLAY_SUSPECT
424 non-TT valid -> VALID_AUTHENTIC
TT raw 4343 -> VALID_CLOSED
TT raw 4F4F -> VALID_OPENED
TT raw 4F43 -> VALID_OPENED_PREVIOUSLY
TT cryptographically valid but TTStatus missing/non-canonical -> SUN_PROFILE_MISMATCH
```

## Forbidden inference

Do not infer seal state from:

- `encPlainStatusByte`;
- `tamperOpened=false`;
- `tamperRisk=false`;
- absence of an error;
- chip model name alone.

Use full two-byte `ttRaw` only.

## Consumer copy

```text
VALID_AUTHENTIC:
Autenticidad criptográfica confirmada.
Este producto no usa sello electrónico de apertura.

VALID_CLOSED:
Autenticidad confirmada. Sello intacto.

VALID_OPENED:
Producto auténtico. Sello abierto.

VALID_OPENED_PREVIOUSLY:
Producto auténtico. El sello fue abierto anteriormente.

VALID_UNKNOWN_TAMPER (legacy/diagnostic only):
Estado intermedio sin afirmación durable de autenticidad o apertura. Un perfil
TT productivo sin TTStatus canónico completo finaliza como SUN_PROFILE_MISMATCH.

REPLAY_SUSPECT:
URL reutilizada. Volvé a tocar físicamente la etiqueta.

SUN_PROFILE_MISMATCH:
No pudimos validar esta lectura.
```

## Diagnostics

Admin diagnostics must include:

- batch row ID;
- carrier profile;
- key fingerprints only;
- crypto error reason;
- UID decoded boolean;
- UID if reliable;
- counter;
- CMAC valid;
- ENC decrypt valid;
- selected MAC-input mode;
- TT raw/perm/current;
- manifest state;
- QA state.

Never expose raw keys.

## Tests

Add fixtures for:

- valid non-TT 424;
- TT closed;
- TT opened;
- TT opened previously;
- replay;
- invalid CMAC;
- wrong K_META;
- wrong K_FILE;
- unknown UID;
- inactive UID;
- duplicate BID.

---

# AGENT 5 - Agro DPP and mobile post-tap experience

## Goal

Create an agro-specific DPP, not a wine template with different text.

## Agro product fields

```ts
AgroProductProfile {
  crop?: string
  seed_variety?: string
  product_family?: string
  active_ingredient?: string
  formulation?: string
  registration_number?: string
  batch_lot?: string
  production_date?: string
  expiration_date?: string
  distributor?: string
  authorized_channel?: string
  safety_sheet_url?: string
  technical_sheet_url?: string
  ppe_content?: object
  stewardship_content?: object
  cropwise_url?: string
  support_contact?: object
}
```

## Mobile order

1. product identity;
2. trust result;
3. lot / registration / channel;
4. technical sheet;
5. responsible-use and PPE;
6. support or advisor;
7. Cropwise CTA;
8. training / loyalty / benefit;
9. provenance / events;
10. technical details collapsed.

## Sensitive action gates

Block claim, warranty, tokenization or trusted registration on:

- `REPLAY_SUSPECT`;
- `SUN_PROFILE_MISMATCH`;
- `NOT_REGISTERED`;
- `NOT_ACTIVE`;
- offline pending verification.

## Experience events

```text
PRODUCT_VIEWED
TECHNICAL_SHEET_VIEWED
SAFETY_SHEET_VIEWED
PPE_CONTENT_VIEWED
STEWARDSHIP_CONFIRMED
CROPWISE_CTA_CLICKED
ADVISOR_CONTACT_REQUESTED
LOYALTY_JOINED
TRAINING_STARTED
TRAINING_COMPLETED
LEAD_CREATED
PROBLEM_REPORTED
```

Every active CTA must complete an action or create a structured event. No dead buttons.

---

# AGENT 6 - GS1 Digital Link resolver and QR fallback

## Goal

Support visible, standards-compatible identity alongside secure NFC.

## Routes

Support at minimum:

```text
/id/01/:gtin
/id/01/:gtin/10/:lot
/id/01/:gtin/10/:lot/21/:serial
```

Support resolver links by:

- product;
- lot;
- serial;
- technical sheet;
- safety sheet;
- DPP;
- support;
- recall/status API when configured.

## Trust model

QR/GS1 result:

```text
GS1_IDENTITY_RESOLVED
NOT_CRYPTOGRAPHICALLY_AUTHENTICATED
```

Copy:

```text
Identidad de producto encontrada.
Esta lectura QR no prueba autenticidad criptográfica.
Use NFC nexID para validación segura cuando esté disponible.
```

## Relationship

A product can share one DPP across:

- visible GS1 QR;
- secure NFC 424;
- TT seal;
- UHF logistics identity.

Do not create duplicate product records for each carrier.

---

# AGENT 7 - Enterprise APIs, Cropwise-ready events and webhooks

## Goal

Make nexID a reliable physical-event source for external systems.

## Event schema

All outbound events require:

```ts
{
  event_id: string
  event_version: string
  event_type: string
  occurred_at: string
  tenant_id: string
  product_id?: string
  sku?: string
  batch_id?: string
  lot_number?: string
  uid_hash?: string
  auth_status?: string
  tamper_status?: string
  replay_status?: string
  risk_score?: number
  distributor_id?: string
  campaign_id?: string
  approximate_location?: object
  consent_flags?: object
  request_id: string
}
```

## Webhook system

Implement/verify:

- tenant subscriptions;
- HMAC-SHA256 signatures;
- key rotation;
- retries with exponential backoff;
- delivery logs;
- latency and response code;
- dead-letter state;
- manual replay;
- idempotency key;
- schema validation;
- request ID propagation.

## Cropwise-ready template

Create a generic connector/event profile:

```text
cropwise_physical_product_event
```

Do not claim a native production Cropwise integration until credentials, APIs and data contract are approved.

## API documentation

Generate OpenAPI for enterprise routes.
Separate:

```text
/public
/api/v1
/admin
/internal
```

Protect internal/demo endpoints by environment and permission.

---

# AGENT 8 - Anti-fraud, analytics, channel and CRM/loyalty

## Goal

Turn validated taps into explainable security and commercial signals.

## Risk factors

- invalid SUN/CMAC;
- replay;
- UID not registered;
- inactive or revoked tag;
- excessive scan frequency;
- impossible travel / geo anomaly;
- distributor or region mismatch;
- tamper before expected sale stage;
- repeated ownership attempts;
- unexpected device/network patterns;
- batch quarantine.

## Risk output

Each event stores:

```text
risk_score 0-100
risk_level LOW/MEDIUM/HIGH/CRITICAL
triggered_rules
recommended_action
```

## Dashboard

Filters:

- tenant;
- SKU;
- product;
- batch;
- lot;
- region;
- distributor;
- risk level;
- date;
- carrier profile.

KPIs:

- valid taps;
- unique units;
- replay;
- invalid/auth failures;
- never-scanned units;
- tamper states;
- geo anomalies;
- content adoption;
- Cropwise CTA;
- registrations/leads;
- webhook delivery health.

## CRM/loyalty

Support:

- leads;
- advisor requests;
- producer registration;
- training completion;
- campaign membership;
- points/vouchers as off-chain default;
- consent evidence.

Blockchain-based loyalty remains optional, not default.

---

# AGENT 9 - Offline and low-connectivity modes

## Goal

Support rural/field workflows without false trust claims.

## Consumer offline

- cache public DPP and approved safety content;
- store pending scan locally;
- show `VERIFICATION_PENDING`;
- sync when online;
- do not enable sensitive actions until backend validation.

Exact copy:

```text
Sin conexión.
La información pública está disponible.
La autenticidad criptográfica se confirmará al recuperar conexión.
```

## Operator offline queue

Store:

```ts
OfflineScanEvent {
  local_id: string
  tenant_id: string
  operator_id: string
  device_id: string
  captured_url: string
  captured_at: Date
  location?: object
  status: "PENDING_BACKEND_VERIFICATION" | "SYNCED_VALID" | "SYNCED_INVALID" | "SYNC_FAILED"
}
```

On sync, backend remains final authority.

## Signed public content

Allow asymmetric signed public certificates for offline verification of:

- technical sheet version;
- safety sheet version;
- public product identity;
- stewardship content snapshot.

This does not replace fresh SUN/SDM authentication.

## Enterprise verifier pack

Disabled by default.
If implemented, must be:

- superadmin-only;
- batch-scoped;
- encrypted;
- expiring;
- device/operator bound when possible;
- fully audited;
- never contain the application KEK, managed-KMS credentials or key handles;
- never available to consumers.

---

# AGENT 10 - Polygon ownership and IOTA proof-layer separation

## Goal

Keep responsibilities clean and optional.

## Polygon

Canonical use:

- ownership claim;
- NFT/certificate;
- transferable warranty;
- collector/high-value asset;
- optional membership.

Do not replace existing Polygon flow.

## IOTA

Optional use:

- manifest hash;
- QA report hash;
- batch activation proof;
- DPP report proof;
- aggregated logistics/sensor evidence;
- audit trail.

Do not create duplicate ownership on IOTA.
Do not put every tap on-chain.
Do not put PII or raw manifests on-chain.

## Provider abstraction

```ts
ProofProviderCode = "none" | "polygon" | "iota"
```

```ts
ProofEvent {
  id: string
  tenant_id: string
  event_type: string
  resource_type: string
  resource_id: string
  payload_hash: string
  provider: ProofProviderCode
  status: string
}
```

```ts
EvidenceAnchor {
  id: string
  tenant_id: string
  provider: "polygon" | "iota"
  network: string
  merkle_root: string
  event_count: number
  tx_hash?: string
  explorer_url?: string
  status: string
  anchored_at?: Date
}
```

## Modes

```text
IOTA_PROVIDER_MODE=disabled|mock|iota_evm_contract|future_notarization_sdk
```

Missing IOTA configuration must disable proof anchoring safely, not break builds or pilot operations.

Testnet proof must be clearly labeled non-permanent.

---

# AGENT 11 - Enterprise security, RBAC, audit and secrets

## Goal

Meet minimum technical due-diligence expectations.

## Tenant isolation

Audit every tenant-owned query:

- products;
- batches;
- tags;
- events;
- orders;
- packaging projects;
- supplier packs;
- manifests;
- leads;
- integrations;
- proofs;
- reports.

Add automated cross-tenant denial tests.

## RBAC permissions

Minimum:

```text
tenant_owner
tenant_admin
security_analyst
operations_manager
packaging_operator
marketing_manager
viewer
reseller_admin
api_integration
super_admin
security_operator
```

Permissions:

```text
supplier_order.create
batch.keys.generate
supplier_pack.export
manifest.import
packaging_lab.manage
qa.approve
qa.plan.approve
batch.activate
risk_rules.write
webhooks.manage
proofs.anchor
audit.read
reports.export
```

`qa.plan.approve` is a tenant-owned policy decision and is not equivalent to
the operational `qa.approve` capability.

## Audit log

Append-only record:

- actor;
- tenant;
- action;
- resource;
- before/after hashes;
- IP;
- user agent;
- request ID;
- timestamp.

Audit:

- key generation;
- key export;
- supplier pack download;
- manifest import;
- QA decision;
- activation;
- override;
- risk-rule change;
- integration change;
- proof anchor;
- data export.

## API keys

- hashed at rest;
- scopes;
- expiration;
- allowed IP/origin;
- rotate/revoke;
- last used;
- rate-limit profile;
- audit log.

## CI security

- dependency audit;
- secret scanning;
- tests;
- lint/typecheck;
- build commit SHA;
- fail on detected secrets.

---

# AGENT 12 - CI, automated tests and regression evidence

## Required tests

### Keys and supplier operations

- random key shape;
- unique keys per sub-batch;
- encrypted-at-rest assertion;
- application envelope master secret/KEK never exported;
- raw sub-batch keys appear only inside the encrypted, one-time, privileged supplier pack;
- raw keys absent from logs;
- supplier ZIP content;
- password one-time behavior;
- unique BID constraint.

### Manifest and QA

- TXT import;
- CSV import;
- wrong batch rejection;
- duplicate UID rejection;
- quantity mismatch;
- dry-run;
- activation gate;
- override audit.

### Carrier semantics

- GS1 identity != cryptographic auth;
- 424 non-TT -> `VALID_AUTHENTIC`;
- TT closed/opened/previously opened;
- UHF does not request K_META/K_FILE;
- basic NFC trust state.

### SUN

- valid;
- replay;
- invalid CMAC;
- wrong key;
- unknown UID;
- inactive tag;
- duplicate BID;
- profile mismatch.

### Packaging Lab

- project creation;
- required test templates;
- evidence upload;
- pass/fail;
- approved carrier link;
- activation dependency.

### Integration

- signed webhook;
- retry;
- idempotency;
- dead letter;
- request ID;
- schema validation.

### Security

- cross-tenant denial;
- permission denial;
- audit event;
- secret redaction;
- private routes protected.

### Offline

- pending queue;
- sync;
- sensitive actions blocked;
- public signature verification;
- no false offline authentication.

### Polygon/IOTA

- existing Polygon regression;
- IOTA disabled safely;
- mock anchor;
- no PII/raw keys in proof payload.

## Final QA evidence

Provide screenshots of:

1. Create Packaging Lab;
2. wet/dry/white/transparent carrier selector;
3. seed-bag placement;
4. bidon body + TT cap placement;
5. create 5K supplier order;
6. five generated sub-batches;
7. key fingerprints;
8. secure supplier export;
9. manifest dry-run;
10. QA matrix;
11. activation gate;
12. agro mobile passport;
13. dashboard/risk map;
14. webhook delivery log;
15. Polygon/IOTA proof status;
16. offline pending state.

---

# 3. Enterprise pilot demo template

Create a reusable template, not Syngenta-specific logic.

Template code:

```text
AGRO_SECURE_PACKAGING_PILOT
```

Defaults:

```text
1 SKU
1 region/channel
Packaging Lab required
5,000 units
5 x 1,000 sub-batches
GS1 visible fallback
424 DNA default
TagTamper optional by opening-risk rule
1 webhook
60-90 day field phase
```

Demo tenant may be labeled Syngenta in seeded non-production data only.

---

# 4. Final acceptance criteria

This goal is complete only when:

1. A superadmin can create a Packaging Lab and supplier order without CLI.
2. A 5,000-unit order creates five isolated sub-batches.
3. Secure keys are unique, encrypted and never exposed outside privileged export.
4. Supplier packs are complete, encrypted, checksummed and audited.
5. Manifests are validated before import.
6. Packaging approval and QA gate activation.
7. Carrier-specific trust states are correct.
8. `/sun` regression tests pass.
9. Agro DPP has real stewardship and support flows.
10. GS1 QR and NFC share the same product/DPP without false authentication claims.
11. Webhooks are signed, retried, logged and versioned.
12. Offline mode never makes false final-auth claims.
13. Polygon remains ownership; IOTA remains optional proof.
14. Tenant isolation and RBAC tests pass.
15. No secrets are detected in repo, logs or artifacts.
16. API, web and dashboard builds pass.
17. Final screenshots and runbook are delivered.

---

# 5. Hard-stop reminders

```text
No more demo-only logic.
No raw keys in tenant folders.
No activation without manifest + Packaging Lab + QA.
No TT unless tail crosses the real opening.
No “authentic” if crypto did not validate.
No “sello intacto” from one byte or missing signal.
No QR presented as secure authentication.
No every-tap blockchain transactions.
No unscoped tenant queries.
No dead buttons.
```

Core product principle:

```text
Packaging must remain operationally invisible.
Trust must remain technically defensible.
Every critical step must be auditable.
```

---

# 6. Engineering checkpoint — 2026-08-02

This section records evidence; it does not weaken the acceptance criteria above.

Implemented and locally validated in the current worktree:

- authoritative enterprise role/capability catalog in DB/API, reflected in the
  Dashboard and protected by parity tests;
- tenant-bound grants, explicit deny precedence and action-specific compound aliases;
- migration 0096 implements and statically validates durable authorization-scope
  serialization against permission/membership write skew;
- tenant-owned production QA dual control;
- deterministic, versioned risk projection separated from canonical NFC evidence;
- sensitive analytics/alert reads require their dedicated evidence/audit permissions;
- ownership claim and POS flows bind exact tenant/tag/UID state, use distributed leases and rate limits, and do not promote demo state into ownership;
- runtime preflight pins a directly authenticated least-privilege database role and rejects owner credentials disguised through `SET ROLE`;
- migration 0096 reconciles historical manifest/SUN ACLs and statically requires
  no direct non-owner grants on internal implementations;
- API auth/RBAC, abuse limits, supplier security, SDK checks, Web tests/build and Dashboard tests/build pass locally.

Required before any production or customer-complete claim:

- apply and verify the complete migration chain through 0096 on a fresh authorized disposable Neon branch;
- prove the reconciled no-grant ACL state with the real runtime-role validator
  and run the two-connection authority-scope write-skew races there;
- configure the staging runtime-only database URL and exact non-secret runtime role variable;
- run authenticated remote HTTP smoke tests and an independent signed-webhook receiver;
- capture physical scans from the configured NTAG 424 DNA/TT samples, including replay and sacrificial TT opening evidence;
- reconcile and verify real Polygon/IOTA testnet receipts without blind retries;
- produce the 16-screen evidence package with its manifest and SHA-256 checksums.

Custody statement: the current AES-GCM application envelope is software key
custody. It is not managed KMS, hardware-backed HSM or an HSM certification.
No local test may be used to imply otherwise.
