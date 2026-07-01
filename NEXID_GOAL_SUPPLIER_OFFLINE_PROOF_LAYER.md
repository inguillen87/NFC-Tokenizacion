# /goal NEXID ENTERPRISE SUPPLIER OPERATIONS + OFFLINE MODE + PROOF LAYER

Build a production-grade nexID enterprise workflow for:

- supplier-programmed NFC/RFID batches
- secure batch key generation
- encrypted supplier encoding packs
- tenant vaults
- manifest import
- QA activation
- offline/low-connectivity scanning modes
- GS1 / QR fallback
- Polygon ownership layer
- IOTA proof layer
- DemoLab / docs / landing / FAQ updates
- enterprise-ready operations for clients such as Syngenta, wineries, cosmetics, events, logistics, mining, pharma and label printers

Do not brainstorm.
Do not redesign the whole app.
Do not break existing production flows.
Do not expose secrets.
Do not hardcode demo data.
Do not ship fake offline verification claims.

Return only:
- exact changed files
- new routes/endpoints
- DB migrations
- screenshots
- build/test results
- blockers

---

## 0. Product Context

nexID is a SaaS platform for physical-to-digital product identity.

Current and target capabilities:

- QR / GS1 Digital Link
- NFC basic tags: NTAG213 / NTAG215 / NTAG216
- secure NFC: NTAG 424 DNA
- tamper secure NFC: NTAG 424 DNA TagTamper
- UHF RFID for boxes, pallets and inventory
- IoT / sensors / logistics events
- anti-fraud / anti-clone / anti-replay
- Digital Product Passport
- ownership / claim / warranty
- Polygon NFT / ownership layer
- IOTA proof / notarization / audit trail layer
- CRM-lite
- marketplace
- loyalty / gamification
- APIs / SDKs
- AI assistants
- enterprise dashboards
- white-label / reseller model

Target buyers:

- enterprise agro companies such as Syngenta
- wineries
- label printers / packaging partners
- cosmetics and perfume brands
- event producers
- hotels / resorts
- logistics / mining / pharma / industrial companies
- investors and reseller partners

---

## 1. Non-Negotiable Rules

### 1.1 Do not break

- `/health`
- `/sun`
- existing SUN/SDM validation
- existing Polygon ownership/tokenization flows
- existing dashboard auth
- existing tenant structure
- existing mobile passport routes
- current monorepo structure

### 1.2 Never expose

- `KMS_MASTER_KEY`
- `DATABASE_URL`
- Vercel secrets
- admin tokens
- Polygon private keys
- IOTA private keys
- webhook secrets
- raw K_META/K_FILE outside explicit supplier export
- raw batch keys in frontend
- raw batch keys in logs
- raw batch keys in permanent plaintext files

### 1.3 Do not claim

- IOTA has zero fees
- every tap goes on-chain
- Polygon and IOTA are official partners unless explicitly configured
- offline mode gives full cryptographic verification for consumers without a backend
- NFC chips transmit GPS or real-time telemetry by themselves
- NTAG213/215/216 provide secure anti-counterfeit authentication
- TagTamper is required for every product

### 1.4 Correct framing

- Polygon = ownership / NFT / claim / certificate / warranty transfer
- IOTA = proof layer / notarization / audit trail / DPP lifecycle evidence
- nexID = business platform and operational source of truth
- NFC/QR = physical identity interface
- IoT/UHF = logistics and industrial telemetry/inventory
- blockchain is optional and activated only where it adds value

---

## 2. Execution Order

Implement in this exact order:

1. Security + key lifecycle
2. Supplier order / sub-batch model
3. Tenant vault and encrypted supplier packs
4. Manifest import + QA + activation
5. SUN/SDM guardrails and carrier profiles
6. Offline / low-connectivity mode
7. GS1 / QR fallback and Digital Link resolver
8. Polygon + IOTA proof layer docs and placeholders
9. Enterprise UI / DemoLab / landing / FAQ
10. Tests, builds, screenshots and final report

Do not jump ahead if earlier phases are incomplete.

---

# AGENT 0 — ORCHESTRATOR / ACCEPTANCE CONTROLLER

## Responsibilities

Coordinate all agents and enforce acceptance criteria.

## Must verify

```bash
npm -w api run build
npm -w web run build
npm -w dashboard run build
npm -w api run test:sun
```

Also search runtime code for forbidden patterns:

KMS_MASTER_KEY
localhost fallback in production
picc_data= hardcoded runtime URL
enc= hardcoded runtime URL
cmac= hardcoded runtime URL
raw K_META/K_FILE in frontend
raw keys in logs

Acceptance
all builds pass
all tests pass
no raw key leakage
no hardcoded dynamic /sun URLs
no broken /sun
no broken /health
final report includes changed files, screenshots and blockers

# AGENT 1 — SECURITY + KEY MANAGEMENT
Goal

Implement secure lifecycle for supplier batch keys.

Core concepts

KMS_MASTER_KEY:
lives only in backend environment
never exported
never sent to supplier
never shown in UI
used only to encrypt/decrypt batch keys at rest

K_META_BATCH:
AES-128, 16 bytes, 32 hex chars
per sub-batch
sent to supplier only through explicit supplier export
stored encrypted at rest
used to decrypt/verify picc_data

K_FILE_BATCH:
AES-128, 16 bytes, 32 hex chars
per sub-batch
sent to supplier only through explicit supplier export
stored encrypted at rest
used for enc, CMAC and session validation

Data model

Create or adapt:

```typescript
BatchKey {
  id: string
  tenant_id: string
  batch_id: string
  key_role: "K_META_BATCH" | "K_FILE_BATCH"
  encrypted_key_ct: string
  key_fingerprint_sha256_prefix: string
  key_version: number
  status: "active" | "rotated" | "revoked"
  created_by: string
  created_at: Date
  exported_at?: Date
  exported_by?: string
}
```

Helpers

Implement:

generateBatchKeyHex(): string
encryptBatchKey(keyHex: string): string
decryptBatchKeyForServerOnly(keyId: string): string
fingerprintBatchKey(keyHex: string): string
redactSecrets(input: unknown): unknown

Secret redaction

Redact in logs/errors:
KMS
K_META
K_FILE
private keys
API keys
webhook secrets
authorization headers
cookies
signed URLs

Acceptance
generated keys are cryptographically random 16-byte / 32-hex strings
keys are encrypted at rest
UI only sees fingerprints
no logs expose keys
raw key export is possible only through explicit supplier pack generation
every export creates an audit log

# AGENT 2 — SUPPLIER ORDER + SUB-BATCH LIFECYCLE
Goal

Create a safe workflow for supplier-programmed tags.

Entities

```typescript
SupplierOrder {
  id: string
  tenant_id: string
  customer_slug: string
  order_code: string
  order_name: string
  total_quantity: number
  sub_batch_size: number
  chip_model: string
  carrier_profile_code: string
  material_type: string
  supplier_name: string
  status:
    | "DRAFT"
    | "PLANNED"
    | "PACK_GENERATED"
    | "SENT_TO_SUPPLIER"
    | "MANIFEST_RECEIVED"
    | "QA_PENDING"
    | "QA_PASSED"
    | "ACTIVE"
    | "QUARANTINED"
    | "CANCELLED"
  notes?: string
  created_by: string
  created_at: Date
}

SupplierSubBatch {
  id: string
  supplier_order_id: string
  tenant_id: string
  batch_id: string
  quantity: number
  sequence: string
  chip_model: string
  carrier_profile_code: string
  material_type: string
  meta_key_id?: string
  file_key_id?: string
  sdm_config: object
  status: string
  manifest_count: number
  active_count: number
  qa_status: "pending" | "passed" | "failed" | "waived"
}
```

Batch ID examples

For a 5,000-tag enterprise pilot split into 5 × 1,000:
SYN-AR-2026-001-A
SYN-AR-2026-001-B
SYN-AR-2026-001-C
SYN-AR-2026-001-D
SYN-AR-2026-001-E

Rules
batch_id globally unique
no silent overwrite
no duplicate BID
if duplicate BID exists, block /sun
each sub-batch has unique K_META and K_FILE
sub-batch can be revoked/quarantined independently
all status transitions audit logged

Acceptance
creating order total_quantity=5000, sub_batch_size=1000 creates 5 sub-batches
each sub-batch has unique BATCH_ID
each secure sub-batch has unique K_META/K_FILE
no CLI/curl/SQL needed by superadmin
tenants cannot create secure supplier packs

# AGENT 3 — TENANT VAULT / SAFE FOLDER STRUCTURE
Goal

Create a folder-like Tenant Vault without storing plaintext keys permanently.

UI concept
Tenant Vault
  /{tenantSlug}
    /supplier-orders
      /{orderCode}
        /sub-batches
        /exports
        /manifests
        /qa-reports
        /proofs

Important

Do not create permanent plaintext files such as:
/NFC/Syngenta/keys.txt

This is forbidden.

Storage model

Use DB metadata + secure object storage.

```typescript
VaultArtifact {
  id: string
  tenant_id: string
  supplier_order_id?: string
  sub_batch_id?: string
  artifact_type:
    | "supplier_pack_zip"
    | "supplier_pack_pdf"
    | "manifest_template"
    | "manifest_received"
    | "qa_report"
    | "proof_report"
  storage_path: string
  sha256: string
  encrypted: boolean
  created_by: string
  created_at: Date
  expires_at?: Date
  download_count: number
  last_downloaded_at?: Date
}
```

Visibility

Superadmin/security operator can see:
encrypted supplier packs
export logs
key export status
QA reports
manifests

Tenant admin can see:
safe order summary
batch status
manifest status
QA status
active tag counts
reports
no raw keys

Acceptance
vault looks like a folder system
raw keys are never stored in plaintext permanent files
encrypted supplier packs require privileged permission
every download is audit logged
tenant cannot download key packs

# AGENT 4 — SUPPLIER ENCODING PACK GENERATOR
Goal

Generate supplier-ready packs that prevent manual errors.

Per sub-batch files

Each supplier pack must include:
README_FIRST.txt
supplier-pack.json
supplier-pack.txt
supplier-pack.pdf
manifest-template.csv
checksum.sha256

TXT format
CLIENT_SLUG=<tenant_slug>
ORDER_CODE=<order_code>
BATCH_ID=<batch_id>
QUANTITY=<quantity>
CHIP_MODEL=<chip_model>
CARRIER_PROFILE=<carrier_profile_code>

K_META_BATCH=<32 HEX>
K_FILE_BATCH=<32 HEX>

URL_TEMPLATE=https://api.nexid.lat/sun?v=1&bid=<BATCH_ID>&picc_data=00000000000000000000000000000000&enc=00000000000000000000000000000000&cmac=0000000000000000

MANIFEST_FORMAT=batch_id,uid_hex

For ntag424_dna

Include:
- NTAG 424 DNA
- SUN/SDM enabled
- dynamic UID
- dynamic read counter
- encrypted enc
- CMAC validation
- anti-replay
- custom nexID URL
- UID manifest required

For ntag424_dna_tt

Include all above plus:
- NTAG 424 DNA TagTamper
- TTStatus mapped into encrypted enc
- TTStatus offset = 0
- TTStatus length = 2 bytes
- 4343 = CLOSED
- 4F4F = OPENED
- 4F43 = OPENED_PREVIOUSLY
- 4949 = INVALID
- normal browser scan must expose TTStatus through enc
- chip should remain readable after opening if technically possible

For basic NFC

For:
ntag213
ntag215
ntag216
event_wristband
hotel_keycard

Do not include K_META/K_FILE.
Use simple URL mode:
https://nexid.lat/t/<tag_code>
or GS1 mode when selected.
Mark trust level:
BASIC_NON_CRYPTOGRAPHIC

For GS1 Digital Link

Generate URI template:
https://id.nexid.lat/01/<GTIN>/10/<LOT>/21/<SERIAL>

For UHF RFID

Generate EPC/UID manifest instructions.
Do not include NFC SUN keys.

Export security
full order ZIP containing all sub-batches
per sub-batch ZIP
encrypted ZIP
random password generated
password shown once to superadmin
checksum generated
export audit logged
recommend sending ZIP and password through separate channels

Acceptance
ZIP contains all expected files
KMS is not included
K_META/K_FILE included only in secure supplier pack export
exported password shown once
checksum generated
audit log created

# AGENT 5 — MANIFEST IMPORT + QA WORKFLOW
Goal

Ensure physical tags from supplier cannot be activated without manifest and QA.

Accepted manifest formats

TXT:
uid_hex
04XXXXXXXXXXXX

CSV:
uid_hex
04XXXXXXXXXXXX

CSV:
batch_id,uid_hex
SYN-AR-2026-001-A,04XXXXXXXXXXXX

Validation

Reject:
invalid UID
duplicate UID in file
duplicate UID already in DB
wrong batch_id
unknown batch
quantity mismatch unless superadmin override
malformed CSV

Produce:
dry-run preview
row count
valid count
invalid count
duplicate count
error CSV export

QA workflow

For each sub-batch:
Paste fresh /sun URL.
Validate batch exists.
Validate UID decoded.
Validate cmacValid=true.
Validate sdmDecryptionOk=true.
Validate read counter.
Reuse same URL.
Expect REPLAY_SUSPECT.
If TagTamper:
closed sample must return ttRaw=4343
opened sacrificial sample must return 4F4F or 4F43
Store QA result with operator and timestamp.

Activation gate

Block activation until:
manifest imported
manifest validated
QA passed

Allow override only by superadmin with mandatory reason.

Acceptance
bad manifest rejected
wrong batch rejected
duplicate UID rejected
QA report generated
activation blocked until QA
override audit logged

# AGENT 6 — SUN / SDM / TTSTATUS GUARDRAILS
Goal

Keep crypto stable and correct.

Rules
/sun uses batch by unique BID only
no random LIMIT 1
duplicate BID returns critical error
K_META/K_FILE loaded only from encrypted DB
replay priority always above product state
no real dynamic /sun URLs hardcoded
no trust decision from encPlainStatusByte

Product states
```typescript
type ProductState =
  | "VALID_AUTHENTIC"
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER"
  | "REPLAY_SUSPECT"
  | "SUN_PROFILE_MISMATCH"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE"
  | "UNKNOWN_BATCH"
  | "MALFORMED_URL"
  | "INVALID";
```

Carrier behavior
ntag424_dna
Autenticidad criptográfica confirmada.
Este producto no usa sello electrónico de apertura.

No show:
sello intacto
sello abierto

ntag424_dna_tt
Use full 2-byte TTStatus only:
4343 => VALID_CLOSED
4F4F => VALID_OPENED
4F43 => VALID_OPENED_PREVIOUSLY
4949 => VALID_UNKNOWN_TAMPER / INVALID_TTSTATUS

Acceptance
DEMO-2026-02 still validates
closed sample logs ttRaw=4343
replay remains REPLAY_SUSPECT
no UI claims seal intact unless product_state=VALID_CLOSED
no UI claims seal opened unless VALID_OPENED or VALID_OPENED_PREVIOUSLY

# AGENT 7 — OFFLINE / LOW-CONNECTIVITY MODE
Goal

Support field usage where internet is poor, without making false security claims.

Critical technical truth

NFC tags are passive and can be read without battery, but secure server-side authentication normally requires backend verification.

For NTAG 424 DNA SUN/SDM:
consumer offline full cryptographic verification is not guaranteed
validating CMAC offline would require secrets or a controlled verifier
raw K_META/K_FILE must never be shipped to public consumer apps

Therefore implement offline mode in levels.

Offline Level 1 — Consumer Offline Fallback

Use case:
consumer taps product with poor connectivity

Behavior:
show cached/static public product info if available
show state:
Verificación pendiente
Necesitamos conexión para confirmar autenticidad criptográfica.

Do not show:
Autenticidad confirmada
Sello intacto
Sello abierto
Ownership claim enabled
Warranty enabled
Tokenization enabled

Actions allowed:
save pending scan locally
retry when online
show public product info
show safety/manual/stewardship info if cached
no ownership/warranty/tokenization until online verification

Implementation:
PWA/local storage pending queue
store scanned URL safely
sync when online
deduplicate pending scans
show sync status

Acceptance:
offline scan does not claim authenticity
pending scan syncs later
once verified online, state updates
replay and invalid are handled after sync

Offline Level 2 — Operator Offline Queue

Use case:
field operator, distributor, warehouse, event staff
no stable internet
later sync to nexID backend

Behavior:
operator scans tags
app stores events locally
marks them PENDING_BACKEND_VERIFICATION
when online, sends all events to backend
backend performs final SUN/SDM validation

Fields:
```typescript
OfflineScanEvent {
  local_id: string
  operator_id: string
  tenant_id: string
  captured_url: string
  captured_at: Date
  approximate_location?: object
  device_id: string
  status:
    | "PENDING_BACKEND_VERIFICATION"
    | "SYNCED_VALID"
    | "SYNCED_INVALID"
    | "SYNC_FAILED"
}
```

Acceptance:
operator can capture scans offline
sync works
no offline final authenticity claim
audit log includes offline capture + sync time

Offline Level 3 — Enterprise Offline Verification Pack

Use case:
authorized enterprise operator
field audit
warehouse
factory QA
no internet
high trust operator

Behavior:
superadmin creates a short-lived offline verification session
backend exports an encrypted verifier pack for a specific tenant/batch
pack expires
pack is audit logged
pack is never available to consumers

Important:
no KMS export
no global secrets
scoped to specific batch/sub-batch
optional, disabled by default
high-risk feature

Verifier pack may include:
batch_id
carrier profile
allowed UID manifest hash
sdm_config
short-lived encrypted batch verification material if explicitly authorized
expiration
operator identity
device binding if possible

Implementation options:
A. Safer default:
offline pack stores only manifest hash and public metadata
final crypto verification still syncs later
B. Advanced enterprise:
offline pack includes encrypted K_META/K_FILE for specific sub-batch
only for trusted operator app
expires quickly
device bound
full audit log
explicit warning

Acceptance:
feature disabled by default
only superadmin can create pack
every export audit logged
pack expires
consumer app never receives keys
no KMS in pack
UI clearly labels offline verification confidence level

Offline Level 4 — Signed Public Offline Certificate

Use case:
QR/GS1/static DPP info must be verifiable offline without secrets

Implementation:
backend signs a public product certificate using asymmetric keys
mobile app or PWA verifies signature with public key
works for public product metadata only
not a replacement for SUN/SDM tap freshness

Fields:
```typescript
OfflinePublicCertificate {
  product_id: string
  batch_id: string
  gtin?: string
  lot?: string
  serial?: string
  issued_at: Date
  expires_at?: Date
  payload_hash: string
  signature: string
}
```

Use:
safety sheet
stewardship instructions
public product data
static DPP snapshot
GS1 QR fallback

Acceptance:
public cert verifies offline
no secrets needed
UI states: "Public information verified", not "fresh NFC authenticity verified"

Offline UX Labels
Use exact labels:
Sin conexión
Información pública disponible

Verificación pendiente
La autenticidad criptográfica se confirmará al volver la conexión.

Escaneo guardado
El evento fue guardado en este dispositivo y se sincronizará automáticamente.

Verificación offline autorizada
Este modo está disponible solo para operadores autorizados.

No verificado
No se pudo validar la autenticidad sin conexión.

Offline acceptance
no false verified claims
sync queue works
offline operator queue works
public signed certificate verifies offline
optional verifier pack is gated and audited
no raw KMS
no consumer key leakage

# AGENT 8 — GS1 / QR DIGITAL LINK LAYER
Goal

Add QR/GS1 as visible fallback and mass-adoption layer.

Routes
Add resolver:
/id/01/:gtin
/id/01/:gtin/10/:lot
/id/01/:gtin/10/:lot/21/:serial
or compatible internal route.

Behavior
QR/GS1 trust level:
GS1_IDENTITY_RESOLVED
NOT_CRYPTOGRAPHICALLY_AUTHENTICATED

Copy:
Identidad de producto encontrada.
Esta lectura QR no prueba autenticidad criptográfica.
Para autenticidad segura, use NFC nexID.

Relationship to NFC
For premium products:
QR GS1 = visible standard identity
NFC 424 = cryptographic authenticity
TagTamper = physical opening evidence

Acceptance
QR resolver works
GS1 fields parsed
DPP opens
no false anti-fraud claim
can link QR product to same tenant/product as NFC tag

# AGENT 9 — SUPERADMIN UX FOR ENTERPRISE ORDERING
Goal

Make superadmin able to run the whole physical tag operation without CLI.

Pages
/admin/tenants
/admin/supplier-orders
/admin/supplier-orders/new
/admin/supplier-orders/:id
/admin/supplier-orders/:id/sub-batches
/admin/supplier-orders/:id/export
/admin/supplier-orders/:id/manifest
/admin/supplier-orders/:id/qa
/admin/tenant-vault/:tenantId

Flow
Create tenant
Create supplier order
Generate sub-batches
Generate keys
Export supplier pack
Mark sent to supplier
Import manifest
Run QA
Activate
Handover to tenant

Carrier profiles
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

Acceptance
superadmin can create 5k / 5x1k order
no CLI required
no keys accidentally shown
next action always clear
tenant sees safe status only

# AGENT 10 — POLYGON + IOTA DOCS / DEMOLAB / LANDING
Goal

Document and present Polygon + IOTA as optional trust layers.

Do not
do not replace Polygon
do not say official partner unless configured
do not say IOTA has zero fees
do not send every tap on-chain
do not make crypto the first selling point for SMEs

Docs to create
docs/blockchain-architecture.md
docs/polygon-ownership-layer.md
docs/iota-proof-layer.md
docs/dpp-event-model.md
docs/enterprise-trust-faq.md

Landing section
Title:
Trust layers for physical products
Cards:
QR / GS1       -> identity and product information
NFC 424        -> cryptographic authenticity
TagTamper      -> physical opening evidence
Polygon        -> ownership and certificates
IOTA           -> audit trail and DPP proof
UHF / IoT      -> logistics and industrial traceability

FAQ entries
Is nexID a blockchain platform?
What is Polygon used for?
What is IOTA used for?
Does every tap go on-chain?
Do customers need wallets?
What data is stored on-chain?
Can SMEs use nexID without blockchain?
Can enterprise clients enable audit trails?
Can Polygon and IOTA be used together?
How does this integrate with GS1, NFC and QR?

DemoLab scenarios
Polygon Ownership Demo
IOTA Proof Layer Demo
Dual Proof DPP
Authorized Network Demo
Sensor Evidence Demo
Offline Field Scan Demo
Supplier Batch Factory Demo

Acceptance
docs created
landing explains layers clearly
DemoLab has scenarios
no false partner claim
no zero-fee IOTA claim
SMEs and enterprise both addressed

# AGENT 11 — PROOF LAYER DATA MODEL PLACEHOLDER
Goal

Add provider abstraction without forcing real IOTA deployment.

Tables/models
```typescript
ProofProvider {
  id: string
  code: "none" | "polygon" | "iota"
  network: string
  enabled: boolean
  rpc_url_env_name?: string
}

ProofEvent {
  id: string
  tenant_id: string
  event_type: string
  resource_type: string
  resource_id: string
  payload_hash: string
  provider: "none" | "polygon" | "iota"
  status: "pending" | "anchored" | "failed" | "disabled"
}

EvidenceAnchor {
  id: string
  tenant_id: string
  provider: "polygon" | "iota"
  network: string
  anchor_type: "single" | "merkle_batch"
  merkle_root: string
  event_count: number
  tx_hash?: string
  explorer_url?: string
  status: "pending" | "confirmed" | "failed"
  anchored_at?: Date
  error_message?: string
}
```

Anchorable event types
batch_created
manifest_imported
manifest_validated
qa_passed
batch_activated
tag_activated
sun_validated
replay_detected
tamper_detected
risk_alert_created
ownership_claimed
certificate_issued
dpp_report_generated
offline_scan_synced

Rules
no raw PII on-chain
no raw business data on-chain
no every-tap on-chain by default
aggregate hashes
provider can be disabled
Polygon ownership remains separate from IOTA proof

Acceptance
placeholder models exist
UI can show Proof Layer disabled/enabled
no real tx attempted unless env configured
no Polygon flow broken

# AGENT 12 — ENTERPRISE MOBILE PASSPORT + CONSUMER FLOW
Goal

Make post-tap experience product-first, not diagnostic-first.

Flow order
Product hero
Trust card
Primary CTA
Provenance
Ownership / warranty / club
Marketplace
Certificate
Technical details collapsed

State rules
VALID_AUTHENTIC
Autenticidad criptográfica confirmada.
No seal claim.

VALID_CLOSED
Autenticidad confirmada.
Sello intacto.

VALID_OPENED
Producto auténtico.
Sello abierto.

REPLAY_SUSPECT
URL reutilizada.
Escaneá físicamente la etiqueta de nuevo.
Block:
ownership
warranty
tokenization

SUN_PROFILE_MISMATCH
No pudimos validar esta lectura.
Do not say product authentic.

Offline pending
Verificación pendiente.
Do not enable sensitive actions.

Acceptance
no dead buttons
claim creates event
warranty creates event
marketplace request creates lead
certificate tied to event/UID/batch/tenant
no product authentic claim when UID null
offline pending blocks sensitive actions

# AGENT 13 — PRICING / QUOTE / PACKAGING SUPPORT
Goal

Make business packaging clear for SMEs and enterprise.

Hardware tiers
QR / GS1
Basic NFC NTAG213/215/216
Secure NFC NTAG424 DNA without tail
Secure Seal NTAG424 DNA TagTamper with tail
UHF RFID
IoT / sensor placeholder

Commercial modules
nexID Core
nexID Secure
nexID Seal
nexID Ownership
nexID Proof Layer
nexID Industrial Trace
nexID Events
nexID Hospitality
nexID Agro

Quote flow
Inputs:
vertical
quantity
carrier profile
security level
printing / packaging
platform modules
integration needs
offline needs
proof layer needs

Output:
recommended package
hardware range
setup range
SaaS range
pilot suggestion
request quote CTA

Acceptance
no cheap public commodity pricing
quote-based enterprise CTA
clear comparison QR vs NFC vs TT vs UHF vs IoT
explains Polygon and IOTA optional add-ons

# AGENT 14 — TESTING / CI / FINAL REPORT
Tests
Add/verify tests for:
key generation
key encryption
supplier order creation
sub-batch generation
supplier pack export
no KMS in export
manifest import
duplicate UID
wrong batch ID
QA gating
activation gating
tenant permissions
no raw key logs
/sun existing flow
TTStatus full 2-byte mapping
offline pending scan queue
offline signed public certificate
proof layer disabled by default
no hardcoded dynamic SUN URLs

Commands
npm -w api run build
npm -w web run build
npm -w dashboard run build
npm -w api run test:sun

Final report must include
Exact changed files
DB migrations
New routes/endpoints
New UI pages
Screenshots:
Create Supplier Order
Generated 5 sub-batches
Export Supplier Pack
Tenant Vault
Manifest Import
QA screen
Offline scan pending
Offline sync complete
Batch Active
Trust Layers landing/docs/DemoLab
Build output
Test output
Remaining blockers

Reference Enterprise Pilot Example

Use this as demo data only, not hardcoded production logic.
Tenant: syngenta
Supplier Order: SYN-AR-2026-001
Total: 5,000 tags
Split: 5 sub-batches x 1,000
BATCH_IDs:
SYN-AR-2026-001-A
SYN-AR-2026-001-B
SYN-AR-2026-001-C
SYN-AR-2026-001-D
SYN-AR-2026-001-E

Each sub-batch:
- unique K_META_BATCH
- unique K_FILE_BATCH
- own supplier pack
- own manifest
- own QA result

Recommended hardware:
NTAG 424 DNA without tail: standard authenticity, lower cost, better label integration.
NTAG 424 DNA TagTamper with tail: only when physical opening matters.
QR / GS1: visible fallback and retail compatibility.
UHF RFID: boxes, pallets, inventory.
IoT: logistics, mining, sensors, cold chain.

Forbidden Shortcuts
Do not implement:
/NFC/<tenant>/keys.txt plaintext
public keys folder
frontend key display
tenant raw-key export
demo key reuse
DEMO-2026-02 dependency
Syngenta hardcoding
real /sun URL hardcoding
every tap on-chain
fake offline verification
IOTA zero-fee claim
official Polygon/IOTA partner claim

Final Product Outcome
The platform should allow a superadmin to safely run this workflow:
Create tenant.
Create supplier order.
Split into sub-batches.
Generate secure batch keys.
Export encrypted supplier packs.
Send packs to factory.
Import returned UID manifests.
QA physical samples.
Activate batch.
Hand over safe dashboard to tenant.
Support offline/low-connectivity scans safely.
Optionally anchor enterprise proof events.
Optionally support Polygon ownership.
Operate DPP, CRM, marketplace, warranty and analytics.

This turns nexID from a demo platform into an enterprise-grade physical product identity operation.
