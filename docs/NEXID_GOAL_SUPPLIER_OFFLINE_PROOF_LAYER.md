# /goal NEXID ENTERPRISE SUPPLIER OPERATIONS + OFFLINE MODE + PROOF LAYER

> **Document status:** condensed operational brief only. The authoritative,
> complete goal (including later requirements and acceptance constraints) is
> [`../NEXID_GOAL_SUPPLIER_OFFLINE_PROOF_LAYER.md`](../NEXID_GOAL_SUPPLIER_OFFLINE_PROOF_LAYER.md).
> Implementations and audits must use the root document when the two differ.

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

Acceptance:
all builds pass
all tests pass
no raw key leakage
no hardcoded dynamic /sun URLs
no broken /sun
no broken /health
final report includes changed files, screenshots and blockers

---

# HARD STOP RULES

Do not store raw keys in plaintext folders.
Do not expose KMS.
Do not let tenant users export supplier key packs.
Do not claim offline authenticity unless backend or authorized verifier confirms it.
Do not replace Polygon with IOTA.
Do not send every tap to blockchain.
Do not hardcode Syngenta or DEMO-2026-02.
Do not break /sun.
Do not touch working SUN/SDM crypto unless a test proves the bug.

No estamos construyendo más demo.
Estamos construyendo operación industrial segura.
