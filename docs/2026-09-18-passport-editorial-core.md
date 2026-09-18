# S4.1 preparation — Passport Studio editorial policy (not deployed)

API baseline: `39dc0f40a62d6792e11c4b075d011db0c6a33af0`.
Isolated branch: `codex/nexid-passport-editorial-core-2026-09-18`.
Status: pure policy and tests prepared. No endpoint, migration, UI, publication or release marker changed.

## Repository findings and scope

`apps/api/src/app/admin/batches/[bid]/product-config/route.ts` authorizes
`batch.product.configure`, reads the current `sdm_config`, builds a replacement
object and updates it. That route does not contain a draft/review workflow,
revision guard or editorial history. This increment DOES NOT replace that route.

`apps/api/src/lib/agro-product-profile.ts` already defines the public
`agro-dpp-v1` product profile. The new policy preserves its public field names,
including productName, brand, crop, seedVariety, activeIngredient, formulation,
registrationNumber, batchLot, technicalSheetUrl, safetySheetUrl, ppe, stewardship
and support. Common identity uses the existing product_name, public_lot_label,
sku, winery, region and image_url fields. This is a proposed strict input policy,
not a claim that old records already satisfy it.

## Executable increment

`apps/api/src/lib/passport-editorial-policy.ts` implements:

- Allowlisted public documents for general/agro and the existing three locales.
  Unknown fields, including UID, CMAC, TT status, counters and raw SDM config,
  are rejected rather than silently copied into the editorial document.
- Draft, review, changes-requested and approved transitions. Edit, review and
  publish authorities are explicit, default-denied inputs provided by the
  future authenticated adapter, not user-editable form values.
- Content digests bound to revisions, canonical tenant/batch IDs and actors.
  A reviewer cannot approve a draft they created, last edited or submitted.
- Review checks for missing product identity and inconsistent duplicated agro
  identity. Missing technical/safety document links are warnings, not legal
  findings; mandatory sector-specific rules still need separate agreement.
- A publication PLAN, never a write: requires approved content and the expected
  current published-content digest, then returns only public-field changes.
  General-template publication does not silently erase an existing agro profile.
- Exact dates, bounded text/lists, HTTPS URL syntax without URL credentials,
  normalized content copies and no network or database dependencies.

## Boundaries that must remain explicit

SHA-256 here detects changes to normalized content; it is not a signature,
source authenticity, document verification or NFC authenticity result.
URLs are not fetched and are not certified safe. Any future document ingestion
needs separate SSRF protections, file validation and access-control decisions.
The editor content is PUBLIC product information; this policy is not a storage
mechanism for private documents, keys, customer records or technical secrets.

These are pure functions. They do not authenticate an actor, persist history,
lock a row, cancel concurrent DB transactions or protect the existing PATCH.
Two processes can evaluate the same revision: only a future transaction that
checks the guards while holding the appropriate row lock can select a winner.
The current draft and authority must come from trusted, authenticated server
reads. The client may not choose reviewer identity, approval or role flags.
Publication-plan output deliberately says `applied:false` and
`requiresAtomicCommit:true`. No preview UI or persisted Passport Studio is
available from this branch yet.

## Checks actually executed

Container environment: Node.js 22.16.0, TypeScript 5.8.3.

```sh
node --experimental-strip-types --check apps/api/src/lib/passport-editorial-policy.ts
node --experimental-strip-types --test apps/api/tests/passport-editorial-policy.test.mjs
```

Result: **38 passed, 0 failed, 0 skipped**. Tests cover field isolation, strict
values, dates, normalization, conflicts, tenant/batch separation, permissions,
independent review, state transitions and unapplied publication plans.
Standalone strict TypeScript checking (`--noEmit --strict`, ES2022/NodeNext,
Node type declarations) also passed. No new runtime package was installed or
added to the repository.

This is NOT a complete Next.js build, regression suite, database transaction
suite, browser test, external security audit or physical TAP certification.
No production tests were inferred from local results.

## Required continuation before activating S4

1. Inspect the current deployment and reconcile any later branches first.
2. Add separately permissioned draft/review/publish endpoints. Resolve actor and
   tenant on the server, preserving the existing role and deny rules.
3. Persist revisions and approval evidence with optimistic guards, row locking
   and an atomic public-field update. Never store or replace the full SDM config
   as an editorial snapshot; preserve crypto fields and unrelated concurrent edits.
4. Compute and verify the live public-content fingerprint INSIDE the publishing
   transaction. Intercept or reconcile the legacy editor route so it cannot
   bypass review/history. Prove concurrent edits and repeated publication locally.
5. Add the mobile preview and compare/approval UI to the batch dossier, showing
   explicitly preview versus published content; no fake NFC or seal badges.
6. Run full builds and regression/browser tests, then stage, verify and promote
   the correct API/dashboard combination. Keep Neon Free and existing infrastructure.

The authorized Windows device was offline during this increment, and the direct
Vercel project call returned 403. Production was not modified to bypass that
verification. No paid resource, DB schema, key, tag or account setting changed.
