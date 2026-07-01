# /goal NEXID POLYGON + IOTA TRUST LAYERS

Build a clean, enterprise-grade multi-ledger trust architecture for nexID.

This goal is only about Polygon + IOTA + DPP Proof Layer.

Do not modify NFC/SUN/SDM cryptographic validation unless required by existing interfaces.
Do not break current Polygon ownership/tokenization flows.
Do not replace Polygon with IOTA.
Do not mint duplicate ownership NFTs on IOTA.
Do not send every tap on-chain.
Do not put PII or raw business data on-chain.
Do not claim IOTA has zero fees.
Do not claim official Polygon/IOTA partnership unless explicitly configured.

---

## 0. Strategic Architecture

nexID must support three independent layers:

```text
nexID Core
  - NFC / QR / GS1
  - NTAG424 DNA
  - NTAG424 DNA TagTamper
  - anti-fraud
  - traceability
  - CRM / loyalty
  - APIs / SDKs
  - Digital Product Passport

Polygon Ownership Layer
  - ownership claim
  - NFT / certificate
  - warranty transfer
  - collector products
  - tokenized product ownership

IOTA Proof Layer
  - notarization
  - audit trail
  - DPP lifecycle evidence
  - manifest hash proof
  - QA proof
  - logistics event proof
  - sensor evidence proof
  - multi-actor traceability
```

Business rule:

Polygon proves who owns or claimed something.
IOTA proves that an event, manifest, report or lifecycle trail was not altered.
nexID remains the operational source of truth.

## 1. Correct Public Messaging

Add this concept everywhere needed:
Blockchain is optional in nexID.

Polygon is used for ownership, NFTs and certificates.
IOTA is used for audit trails, notarization and industrial DPP evidence.
Clients can use nexID without blockchain, with Polygon only, with IOTA only, or with both layers depending on the use case.

Never say:
IOTA is free.
Every tap goes on-chain.
Polygon and IOTA are official partners.
IOTA replaces Polygon.
NFT guarantees physical authenticity by itself.

Use:
Polygon-compatible ownership layer.
IOTA-ready proof layer.
Optional blockchain evidence.
Tamper-proof audit trail.
Digital Product Passport proof.

## 2. Docs To Create

Create these docs:
docs/blockchain-architecture.md
docs/polygon-ownership-layer.md
docs/iota-proof-layer.md
docs/dpp-event-model.md
docs/enterprise-trust-faq.md
docs/proof-layer-runbook.md

### docs/blockchain-architecture.md

Must explain:
- nexID is blockchain-agnostic.
- Polygon remains the canonical ownership layer.
- IOTA is an optional proof/audit layer.
- No raw PII goes on-chain.
- No every-tap on-chain design.
- NFC proves physical interaction.
- Backend stores operational truth.
- Blockchain stores proofs/hashes/certificates only when useful.

### docs/polygon-ownership-layer.md

Must explain:
Polygon is used for:
- ownership claim
- NFT minting
- certificate issuance
- transferable warranty
- collector product ownership
- product tokenization
- membership / loyalty if enabled

Also document:
- current Polygon contracts
- networks configured
- env variables required
- minting flow
- claim flow
- walletless or custodial UX if available
- how Polygon relates to DPP

### docs/iota-proof-layer.md

Must explain:
IOTA is used for:
- manifest hash notarization
- QA report hash
- batch activation proof
- logistics event proof
- DPP lifecycle audit trail
- sensor evidence aggregation
- distributor/actor event evidence

Must include:
- IOTA EVM Testnet is for PoC only.
- Testnet can reset.
- IOTA transactions require gas.
- Do not call it zero-fee.
- Do not store business secrets on-chain.

### docs/dpp-event-model.md

Define event taxonomy:
PRODUCT_CREATED
BATCH_CREATED
SUPPLIER_ORDER_CREATED
SUPPLIER_PACK_EXPORTED
MANIFEST_IMPORTED
MANIFEST_VALIDATED
QA_PASSED
QA_FAILED
BATCH_ACTIVATED
TAG_ACTIVATED
SUN_VALIDATED
REPLAY_DETECTED
TAMPER_CLOSED
TAMPER_OPENED
TAMPER_OPENED_PREVIOUSLY
RISK_ALERT_CREATED
OWNERSHIP_CLAIMED
NFT_MINTED
CERTIFICATE_ISSUED
WARRANTY_REGISTERED
SHIPMENT_DISPATCHED
DISTRIBUTOR_RECEIVED
STEWARDSHIP_CONFIRMED
SENSOR_BATCH_HASHED
DPP_REPORT_GENERATED
POLYGON_ANCHORED
IOTA_ANCHORED

### docs/enterprise-trust-faq.md

Add FAQ answers for:
Is nexID a blockchain platform?
What is Polygon used for?
What is IOTA used for?
Can Polygon and IOTA be used together?
Does every NFC tap go on-chain?
Does the consumer need a wallet?
What data is stored on-chain?
Can SMEs use nexID without blockchain?
Can enterprise clients enable audit trails?
How does this work with GS1, NFC and QR?
How does this help Syngenta/agro/industrial clients?

## 3. Data Model

Create provider abstraction.

### ledger_providers
```typescript
ledger_providers {
  id: string
  code: "none" | "polygon" | "iota"
  name: string
  network: string
  chain_id?: number
  rpc_url_env_name?: string
  explorer_base_url?: string
  enabled: boolean
  purpose: "ownership" | "proof" | "both"
  created_at: Date
  updated_at: Date
}
```
Default providers:
none
polygon_amoy_or_current_testnet
polygon_mainnet_if_configured
iota_evm_testnet
iota_evm_mainnet_if_configured

### proof_events
```typescript
proof_events {
  id: string
  tenant_id: string
  event_type: string
  resource_type: string
  resource_id: string
  batch_id?: string
  tag_id?: string
  product_id?: string
  payload_json: object
  payload_hash: string
  hash_algorithm: "sha256"
  provider_preference: "none" | "polygon" | "iota"
  status: "pending" | "ready" | "anchored" | "failed" | "disabled"
  created_at: Date
}
```

### evidence_anchors
```typescript
evidence_anchors {
  id: string
  tenant_id: string
  provider: "polygon" | "iota"
  network: string
  anchor_type: "single" | "merkle_batch"
  resource_type?: string
  resource_id?: string
  event_count: number
  event_hashes: string[]
  merkle_root: string
  tx_hash?: string
  explorer_url?: string
  status: "pending" | "submitted" | "confirmed" | "failed" | "disabled"
  anchored_at?: Date
  error_message?: string
  created_by?: string
  created_at: Date
}
```

### ownership_records
If not already formalized, ensure Polygon ownership records stay separate:
```typescript
ownership_records {
  id: string
  tenant_id: string
  product_id?: string
  tag_id?: string
  batch_id?: string
  owner_user_id?: string
  wallet_address?: string
  provider: "polygon"
  network: string
  token_contract?: string
  token_id?: string
  tx_hash?: string
  status: "pending" | "minted" | "claimed" | "transferred" | "failed"
  created_at: Date
}
```
Rule:
ownership_records are Polygon-first.
evidence_anchors are IOTA-first.
Do not merge these concepts.

## 4. Provider Roles

Implement role separation in code.

Polygon provider
Used only for:
OWNERSHIP_CLAIMED
NFT_MINTED
CERTIFICATE_ISSUED
WARRANTY_TOKENIZED
OWNERSHIP_TRANSFERRED

IOTA provider
Used for:
BATCH_CREATED
SUPPLIER_PACK_EXPORTED
MANIFEST_IMPORTED
MANIFEST_VALIDATED
QA_PASSED
BATCH_ACTIVATED
TAG_ACTIVATED
SUN_VALIDATED aggregated only
REPLAY_DETECTED aggregated only
TAMPER_OPENED aggregated only
SHIPMENT_DISPATCHED
DISTRIBUTOR_RECEIVED
STEWARDSHIP_CONFIRMED
SENSOR_BATCH_HASHED
DPP_REPORT_GENERATED

Important:
Do not anchor every tap individually.
Aggregate high-volume scan events into Merkle roots.

## 5. Merkle Hashing / Aggregation

Implement deterministic payload hashing.

Function
canonicalizePayload(payload: object): string
hashPayload(payload: object): string
buildMerkleRoot(eventHashes: string[]): string
verifyMerkleProof(eventHash: string, proof: string[], root: string): boolean

Rules:
- canonical JSON ordering
- sha256 hash
- no raw PII in payload
- use hashed contact identifiers if needed
- raw event data remains in nexID DB
- blockchain gets root/hash only

Example payload
```json
{
  "event_type": "MANIFEST_VALIDATED",
  "tenant_id": "syngenta",
  "batch_id": "SYN-AR-2026-001-A",
  "manifest_hash": "sha256...",
  "valid_rows": 1000,
  "invalid_rows": 0,
  "timestamp": "2026-06-30T00:00:00.000Z"
}
```

## 6. IOTA Proof Adapter

Implement IotaProofProvider.
Do not make it mandatory.

Interface
```typescript
interface ProofProvider {
  code: "iota" | "polygon" | "none";
  anchorMerkleRoot(input: {
    tenantId: string;
    merkleRoot: string;
    eventCount: number;
    metadataHash?: string;
  }): Promise<{
    txHash?: string;
    explorerUrl?: string;
    status: "submitted" | "confirmed" | "failed";
    error?: string;
  }>;
}
```

Implement modes
IOTA_PROVIDER_MODE=disabled
IOTA_PROVIDER_MODE=mock
IOTA_PROVIDER_MODE=iota_evm_contract
IOTA_PROVIDER_MODE=iota_notarization_sdk_later

Mode behavior
disabled:
No tx.
Store proof event as disabled.

mock:
No tx.
Generate fake tx hash clearly labeled mock.
For local demo only.

iota_evm_contract:
Use EVM-compatible RPC.
Submit merkleRoot to simple Anchor contract.

iota_notarization_sdk_later:
Placeholder for official Notarization toolkit integration.

## 7. IOTA EVM Anchor Contract

Create a minimal EVM contract for PoC only.
Path:
contracts/iota/LogisticsEventAnchor.sol

Contract:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LogisticsEventAnchor {
    event RootAnchored(
        bytes32 indexed merkleRoot,
        string indexed tenantIdHash,
        string resourceType,
        string resourceId,
        uint256 eventCount,
        uint256 anchoredAt
    );

    function anchorRoot(
        bytes32 merkleRoot,
        string calldata tenantIdHash,
        string calldata resourceType,
        string calldata resourceId,
        uint256 eventCount
    ) external {
        emit RootAnchored(
            merkleRoot,
            tenantIdHash,
            resourceType,
            resourceId,
            eventCount,
            block.timestamp
        );
    }
}
```
Rules:
- no PII
- no raw manifest
- no raw UID list
- no raw keys
- no business secrets

## 8. Backend Endpoints

Create protected admin endpoints.

POST /admin/proof/events
Create proof event.
Input:
```json
{
  "event_type": "MANIFEST_VALIDATED",
  "resource_type": "batch",
  "resource_id": "SYN-AR-2026-001-A",
  "payload": {}
}
```
Output:
```json
{
  "ok": true,
  "proof_event_id": "...",
  "payload_hash": "..."
}
```

POST /admin/proof/anchor
Anchor events.
Input:
```json
{
  "provider": "iota",
  "event_ids": ["..."],
  "anchor_type": "merkle_batch"
}
```
Output:
```json
{
  "ok": true,
  "anchor_id": "...",
  "merkle_root": "...",
  "provider": "iota",
  "status": "submitted"
}
```

GET /admin/proof/anchors
List anchors.

GET /public/proof/:anchorId
Public verifier page.
Must show:
provider
network
merkle_root
tx_hash
explorer_url
event_count
anchored_at
verification status
No sensitive data.

POST /public/proof/verify
Input:
```json
{
  "event_hash": "...",
  "anchor_id": "..."
}
```
Output:
```json
{
  "ok": true,
  "included": true,
  "provider": "iota",
  "merkle_root": "...",
  "tx_hash": "..."
}
```

## 9. Polygon Ownership Audit

Do not rewrite Polygon.
Audit current Polygon implementation and document:
- contracts used
- networks
- env vars
- mint flow
- claim flow
- certificate flow
- wallet/custodial flow if any
- failure states

Add admin page:
/admin/blockchain/polygon
Show:
network
contracts
last mints
failed mints
ownership records
claim records
Do not expose private keys.

## 10. Proof Layer UI

Add dashboard area:
/admin/proof
/admin/proof/events
/admin/proof/anchors
/admin/proof/providers

Batch detail tab
Add:
Proofs
Show:
manifest hash
QA hash
batch activation proof
IOTA anchor status
Polygon ownership status if applicable

Product passport mobile
Add collapsed block:
Digital Proofs
Display:
Physical authenticity: nexID NFC
Ownership: Polygon active / inactive
Audit Trail: IOTA active / inactive
Last proof: manifest validated / QA passed / DPP report anchored
Do not over-emphasize blockchain in mobile consumer UX.

## 11. Landing / FAQ / DemoLab

Add section:
Trust layers for physical products
Cards:
QR / GS1
NFC 424
TagTamper
Polygon
IOTA
UHF / IoT

Copy:
Polygon powers optional ownership and certificates.
IOTA powers optional audit trails and DPP evidence.
nexID works with or without blockchain.

DemoLab scenarios
Add:
Polygon Ownership Demo
IOTA Proof Layer Demo
Dual Proof DPP
Authorized Network
Sensor Evidence
Syngenta Agro DPP
Wine Collector Ownership

FAQ
Add answers for:
What is Polygon used for?
What is IOTA used for?
Do I need both?
Does every tap go on-chain?
Does the consumer need a wallet?
Is this useful for SMEs?
Is this useful for enterprise clients?
Can I disable blockchain?
Can I export proof for auditors?

## 12. Enterprise Use Cases

Add demo templates.

Syngenta / agro
QR/GS1 = visible product/lote identity
NFC 424 = secure authenticity
TagTamper = optional seal/opening for selected SKUs
Polygon = optional ownership/certificate if needed
IOTA = manifest/QA/stewardship/audit proof

Wine
NFC 424 without tail = premium invisible authenticity
TagTamper = ultra-premium anti-refill
Polygon = collector ownership
IOTA = batch proof / provenance report

Pharma / cosmetics
TagTamper = package opening
Polygon = warranty/certificate if useful
IOTA = compliance trail

Logistics / mining
UHF/IoT = inventory and telemetry
IOTA = sensor/logistics proof
Polygon = usually not needed unless asset ownership tokenization is required

## 13. Configuration

Add envs:
POLYGON_PROVIDER_MODE=enabled|disabled|mock
POLYGON_RPC_URL=
POLYGON_CHAIN_ID=
POLYGON_PRIVATE_KEY=
POLYGON_CERTIFICATE_CONTRACT=

IOTA_PROVIDER_MODE=disabled|mock|iota_evm_contract|iota_notarization_sdk_later
IOTA_EVM_RPC_URL=
IOTA_EVM_CHAIN_ID=
IOTA_EVM_PRIVATE_KEY=
IOTA_EVM_ANCHOR_CONTRACT=
IOTA_EXPLORER_BASE_URL=

Rules:
- missing Polygon env disables Polygon flows safely unless required
- missing IOTA env disables IOTA Proof Layer safely
- no build should fail only because IOTA is not configured
- no private key logged
- testnet warning shown in UI

## 14. Testnet Warning

Every IOTA testnet screen must show:
IOTA EVM Testnet is for prototyping only. Testnet data may reset and must not be used as legal/commercial proof.

IOTA’s own docs state that IOTA EVM Testnet can have occasional resets with no data retention, so Codex must not present testnet anchors as permanent enterprise evidence.

## 15. Tests

Add tests for:
canonical payload hash
Merkle root generation
Merkle proof verification
proof event creation
anchor creation with provider=disabled
anchor creation with provider=mock
no raw PII on-chain payload
no raw UID manifest on-chain payload
no private keys in logs
Polygon existing flows unaffected
IOTA disabled by default
public proof page does not expose sensitive data

Commands:
npm -w api run build
npm -w web run build
npm -w dashboard run build
npm -w api run test:sun

## 16. Acceptance Criteria

Complete only if:
Polygon ownership flows still work.
IOTA Proof Layer can be disabled.
IOTA mock proof can anchor a Merkle root locally.
IOTA EVM contract adapter is isolated behind env config.
No PII goes on-chain.
No every-tap-on-chain behavior.
Public proof verifier works.
Batch detail shows Polygon and IOTA separately.
Mobile DPP shows proofs collapsed and user-friendly.
Landing/FAQ/DemoLab explain Polygon vs IOTA clearly.
No official partner claim.
No zero-fee IOTA claim.
Builds pass.

## 17. Final Deliverable

Return only:
1. Exact changed files
2. DB migrations
3. New routes/endpoints
4. New contracts
5. New docs
6. Screenshots:
   - Blockchain architecture docs
   - Landing trust layer
   - DemoLab Polygon demo
   - DemoLab IOTA proof demo
   - Admin proof providers
   - Admin evidence anchors
   - Batch detail proof tab
   - Public proof verifier
7. Build output
8. Test output
9. Remaining blockers

## 18. Core Principle
Do not build crypto theater.

Polygon is ownership.
IOTA is evidence.
nexID is the enterprise product identity platform.
