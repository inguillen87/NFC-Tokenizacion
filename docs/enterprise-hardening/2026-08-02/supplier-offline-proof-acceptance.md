# nexID enterprise supplier, offline and proof layer - local acceptance

Date: 2026-08-02  
Repository head used as baseline: `e0e7a049463e771ce15563b5a78e40f90172fc74`  
Branch: `main`

> **LOCAL ACCEPTANCE, NOT A PRODUCTION DEPLOYMENT.** This document records the
> current working-tree implementation and reproducible local checks. The tree
> intentionally remains uncommitted and contains pre-existing and sprint work.
> No production database migration, production deployment, physical NFC tap or
> new live-chain transaction was performed for this acceptance.

## Result

The ordered supplier workflow is implemented through tenant-bound orders,
sub-batches, per-sub-batch NFC keys, encrypted one-time factory packs,
manifests, receiving QA, activation and audited handover. Offline, GS1, Polygon
and IOTA remain separate evidence layers and do not weaken or replace the
physical NFC cryptographic path.

The final adversarial pass found four issues and they were fixed before this
acceptance:

1. Tenant Vault recovery now requires MFA at the route and transaction layers.
2. The transaction revalidates and locks the current superadmin session, user
   and membership before it can return the encrypted artifact.
3. Empty encrypted payloads cannot create a download receipt, audit event or
   counter increment.
4. Vault, supplier lifecycle and non-SUN QA reject secret-shaped free-form
   audit text in TypeScript and in authoritative PostgreSQL writers.

Custody transitions are also rate-limited and require MFA. Their dashboard
controls fail closed and explain the MFA requirement instead of issuing a
request that will silently fail.

## Preserved physical NFC path

The implementation preserves the separation:

`physical tag -> phone -> /sun -> tenant/sub-batch lookup -> server-side
SUN/CMAC verification -> redacted evidence`

- `K_META_BATCH` and `K_FILE_BATCH` remain per sub-batch.
- Raw batch keys exist only in the explicit, encrypted supplier-pack ceremony.
- The tenant dashboard receives status, fingerprints and hashes, never raw key
  packs.
- Static QR, GS1 and NTAG213/215/216 QA never claims SUN, anti-replay,
  TagTamper or physical authenticity.
- Polygon is an optional digital ownership/certificate layer.
- IOTA is an optional proof/notarization layer.
- Neither chain is executed for every NFC read.

## Principal implementation files

Security and custody:

- `apps/api/src/lib/audit-freeform-secret-policy.ts`
- `apps/api/src/lib/batch-keys.ts`
- `apps/api/src/lib/tenant-vault.ts`
- `apps/api/src/app/admin/tenant-vault/[tenantId]/route.ts`
- `apps/api/src/app/admin/tenant-vault/[tenantId]/artifacts/[artifactId]/download/route.ts`
- `apps/api/src/lib/supplier-order-lifecycle.ts`
- `apps/api/src/app/admin/supplier-orders/[orderId]/lifecycle/route.ts`
- `apps/api/src/lib/supplier-carrier-qa-evidence.ts`
- `apps/api/src/lib/supplier-carrier-qa-commit.ts`
- `apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts`
- `apps/api/src/lib/fleet-rate-limit-policy.ts`

Atomic SDK and webhook boundary:

- `apps/api/src/lib/sdk-external-event-writer.ts`
- `apps/api/src/app/api/v1/sdk/events/route.ts`
- `apps/api/src/lib/sdk-webhooks.ts`
- `apps/api/db/migrations/20260802180000_0083_sdk_event_webhook_atomic_outbox.sql`

No-CLI supplier and Vault UX:

- `apps/dashboard/src/components/supplier-order-console.tsx`
- `apps/dashboard/src/components/supplier-order-lifecycle-panel.tsx`
- `apps/dashboard/src/components/tenant-vault-browser.tsx`
- `apps/dashboard/src/components/tenant-vault-download-control.tsx`
- `apps/dashboard/src/app/(app)/supplier-orders/[orderId]/page.tsx`
- `apps/dashboard/src/app/(app)/admin/tenant-vault/[tenantId]/page.tsx`
- `apps/dashboard/src/lib/tenant-vault-contract.ts`

Offline, GS1, public proof and SDK:

- `apps/api/src/lib/offline-verifier.ts`
- `apps/api/src/lib/offline-public-certificate.ts`
- `apps/api/src/app/public/offline-certificates/gs1/route.ts`
- `apps/api/src/app/public/offline-certificates/jwks/route.ts`
- `apps/api/src/app/api/v1/sdk/offline-sync/route.ts`
- `apps/web/src/app/offline/page.tsx`
- `apps/web/src/app/id/_lib/gs1-digital-link-resolver.ts`
- `packages/sdk/src/index.ts`

Public product experience:

- `apps/web/src/app/(public)/demo-lab/demo-lab-scenario-catalog.ts`
- `apps/web/src/app/(public)/demo-lab/demo-lab-client.tsx`
- `apps/web/src/components/pricing-quote-configurator.tsx`
- `apps/web/src/components/pricing-quote-model.ts`
- `apps/web/src/app/pricing/page.tsx`

## New or extended HTTP contracts

- `GET /admin/tenant-vault/:tenantId`
- `POST /admin/tenant-vault/:tenantId/artifacts/:artifactId/download`
- `POST /admin/supplier-orders/:orderId/lifecycle`
- `POST /admin/supplier-orders/:orderId/qa` extended for explicit non-SUN QA
- `POST /api/v1/sdk/events` moved to an atomic business-event/outbox writer
- `POST /api/v1/sdk/offline-sync` extended with final verification contracts
- `GET /public/offline-certificates/gs1`
- `GET /public/offline-certificates/jwks`

Privileged downloads and lifecycle transitions require a persisted
superadmin session with MFA, a bounded request, an idempotency key, a
distributed rate-limit reservation and an atomic audit receipt.

## Database migrations in this acceptance scope

- `20260801090000_0075_supplier_production_qa_acceptance.sql`
- `20260802090000_0076_supplier_production_activation_v2.sql`
- `20260802113000_0077_tenant_api_key_lifecycle.sql`
- `20260802130000_0078_webhook_destination_cutover.sql`
- `20260802150000_0079_supplier_order_atomic_create.sql`
- `20260802153000_0080_offline_scan_history_index.sql`
- `20260802160000_0081_supplier_manifest_atomic_import.sql`
- `20260802170000_0082_consumer_session_revocation.sql`
- `20260802180000_0083_sdk_event_webhook_atomic_outbox.sql`
- `20260802190000_0084_tenant_vault_audited_download.sql`
- `20260802200000_0085_supplier_non_sun_qa_evidence.sql`
- `20260802210000_0086_supplier_order_lifecycle.sql`

The migration-safety gate parsed all 38 governed migrations and passed. The
release watermark and preflight inventory are pinned through `0086`.

## Reproducible validation results

| Gate | Result |
| --- | --- |
| API production build | PASS; Next.js compiled and generated 25 pages |
| Supplier security suite | PASS; 199/199 |
| API auth/security suite | PASS; 154/154 |
| API rate-limit suite | PASS; 54/54 |
| Dashboard production build | PASS; Next.js compiled and generated 75 pages |
| Dashboard full tests | PASS; 296/296 |
| Web tests/build | PASS in this sprint; 256/256 and 57 pages; untouched by the final API/dashboard remediation |
| Server SDK check | PASS in this sprint; 29 runtime + 3 package tests, typecheck/build/package smoke |
| Migration safety | PASS; 38 governed migrations |
| Static QA | PASS; no dead buttons, fake flows or unsafe placeholders |
| Tracked-secret scan | PASS; 1,717 tracked files, no recognized live-secret format |
| Placeholder/public-link gate | PASS |
| Next dynamic-route gate | PASS across 3 apps |
| Dependency audit | PASS; 0 high-or-greater production vulnerabilities reported |
| `git diff --check` | PASS; only line-ending conversion warnings |
| Local `/health` production-start smoke | PASS; HTTP 200, process liveness only, no-store and nosniff |

The first repeated API build attempt was blocked by the already-running local
API process holding Prisma's Windows DLL. The exact listener on port 3003 was
verified and stopped; the clean rerun above then passed. This was an operating
system file lock, not a code failure.

## Screenshot evidence

Local acceptance screenshots are under
`artifacts/acceptance/2026-08-02-public/`:

- `01-home.png`
- `02-pricing.png`
- `03-demo-lab.png`
- `04-qr-gs1.png`
- `05-nfc-424.png`
- `06-offline-verifier.png`
- `07-polygon-ownership.png`
- `08-iota-proof.png`
- `09-supplier-batch-factory.png`

Their exact SHA-256 inventory is
`artifacts/acceptance/2026-08-02-public/checksums.sha256`. These images are
local acceptance evidence, not proof of production deployment, physical tag
behavior or a live blockchain write.

## Explicit blockers before production certification

1. Migrations `0082` through `0086` have not been executed against a real
   disposable PostgreSQL/Neon branch in this acceptance run.
2. No production deploy or production smoke was performed.
3. No physical tap/TagTamper ceremony was performed with the ten NTAG 424
   samples. Code-path tests are not hardware certification.
4. No new Polygon or IOTA transaction/certificate was verified live in this
   run. Local demos remain explicitly configured or simulated where applicable.
5. Tenant Vault uses application-level envelope encryption. It is **not** a
   managed KMS, HSM or non-exportable signing service.
6. Real MFA enrollment/step-up remains an operational prerequisite. Sensitive
   Vault recovery and supplier custody transitions now fail closed when the
   persisted session does not have MFA.
7. The Cloudflare API token pasted previously into chat must be rotated or
   revoked. This document does not claim that rotation occurred.
8. GS1 production-domain and DNS ownership still require live external proof.

The local implementation is ready for a disposable PostgreSQL migration run,
authenticated staging smoke and physical sample ceremony. It must not be sold
as production-certified, HSM-backed or physically validated until those gates
exist as evidence.
