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
