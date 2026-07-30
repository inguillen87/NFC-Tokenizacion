# Enterprise gap remediation sprint — 2026-07-28

## Executive verdict

NexID already has a credible product surface: SUN/SDM verification, normalized event contracts, tenant-aware SSE, analytics, maps, SDK/API keys, signed webhook delivery, public proof labs and mobile post-tap experiences. This sprint closes the identified local-code gaps in identity-bound administration, atomic SUN persistence, privacy defaults, webhook lifecycle, canonical event writing and operational incident handling. It is still not correct to call the whole platform enterprise-complete: the remaining gaps are controlled database rollout, external runtime and physical-tag evidence, operational SLOs and standards conformance.

The physical NFC path remains authoritative and unchanged by this sprint. GS1 Digital Link/QR is an identity and discovery carrier; it does not become cryptographic NFC authentication. Software envelope encryption remains software custody and is not described as HSM.

## Completed in this slice

### Destructive E2E harness is fail-closed

- Removed the implicit `https://api.nexid.lat` target and automatic `.env.local` credential loading.
- Requires an explicit `local` or recognizably non-production `staging` target, exact mutation consent, dedicated E2E credentials and an exact database-host allowlist.
- Production NexID hosts are rejected without an override.
- Removed ownership deletion/fallback-tag mutation, OTP hash extraction, OTP brute force and session/OTP logging.
- The internal demo scanner now issues the short-lived fresh-tap capability server-side and records a diagnostic receipt; the harness no longer signs capabilities with the admin API key.
- Added focused positive and negative safety tests and a non-secret environment template at `apps/api/scripts/e2e-simulation.env.example`.

This makes the harness safer to prepare for a future isolated staging E2E. It has not been run against any database or remote deployment in this slice.

### GS1 resolver 1.2 foundation

- Validates 14-digit GTIN check digits and bounded AI 10/AI 21 path qualifiers.
- Supports `/id/01/...` and the `id.nexid.lat/01/...` route family for GTIN, lot and serial combinations.
- Supports `GET`, `HEAD`, `OPTIONS`, CORS, HTML link presentation, `application/linkset+json`, `application/json` and JSON-LD negotiation.
- Emits GS1 vocabulary relations for default product information and traceability, with the immutable GS1 1.2.0 linkset context.
- Exposes `/.well-known/gs1resolver` and advertises only primary key `01`, which is the implemented scope.
- Returns `400` for malformed identifiers and `404` for unsupported link types.
- Preserves the QR/NFC trust boundary in both resolver metadata and the target passport parameters.
- Drops resolver-owned and secret-shaped query parameters before redirecting. This is an intentional security constraint and a known deviation from the GS1 default of forwarding the complete query string.

The resolver is now backed by a tenant-owned registry: syntactically valid but unknown, suspended or retired identifiers return `404`, registry outages fail closed, and caller-selected tenant/batch scope cannot override the registered owner. Registry lifecycle uses keyset pagination, compare-and-swap transitions and append-only audit. Production web resolution requires the explicit server-only `NEXID_GS1_REGISTRY_API_URL`; there is no implicit API fallback. This remains a standards-aligned foundation, not a claim of full GS1-Conformant Resolver certification. Full conformance still requires language/context selection, normative schema validation and a passing run of the official GS1 Resolver 1.2 test suite on the deployed HTTPS domain.

### EPCIS/CBV 2.0 bounded foundation

- Added tenant-scoped `capture`, `events` query and paginated `export` routes with dedicated `sdk:epcis:write/read` scopes.
- Capture is required-idempotent and all-or-none across EPCIS storage, registered GS1 identifiers, canonical events and webhook outbox rows.
- Hard limits cover bytes, events, identifiers, canonical fan-out, query pages and a dedicated 12-captures/minute distributed budget.
- Query and export use keyset pagination and never expose another tenant's rows.
- EPCIS projections are explicitly `declared_business_event` with `cryptographic_authentication: false`; SUN/SDM/CMAC and TagTamper code is unchanged.
- OpenAPI publishes media types, scopes, idempotency, headers and bounded failure responses.

This is not a full EPCIS conformance or certification claim. Complete normative JSON Schema/SHACL validation, broader query/subscription/master-data behavior and official deployed conformance testing remain open. The detailed contract and rollout order are in `docs/enterprise-hardening/2026-07-29/gs1-epcis-foundation.md`.

### Location privacy is explicit and approximate by default

- The mobile passport no longer requests geolocation on mount. It presents an optional, explicit action and remains fully usable after denial or without browser geolocation.
- The purchase/ownership flow has a separate unchecked consent control; submitting a receipt no longer silently requests location.
- Browser requests use low-accuracy mode and round latitude/longitude to three decimal places before transmission.
- The API independently requires affirmative consent plus `approximate` precision, rounds again, enforces a minimum reported accuracy of 150 metres and discards altitude/speed.
- Ownership risk signals use the same server-side normalizer, so a custom client cannot bypass the approximate-default boundary by posting exact coordinates directly.
- Location remains a spoofable, client-reported auxiliary signal and is never promoted to proof of custody, route, purchase or physical authenticity.

### Every current batch-key writer binds the encrypted envelope to its owner and purpose

- Internal registration and both supported demo seed paths now use the same batch-key lifecycle helper as Supplier Orders and key rotation.
- New v2 envelopes authenticate tenant ID, BID, key role and key version as AES-GCM AAD; a writer cannot create a batch-key envelope without those fields.
- Batch `sdm_config` persists the corresponding `key_version`, so SUN decrypts with the same expected context.
- Legacy unversioned envelopes remain readable through the explicitly pinned migration path, preserving the existing physical samples while new rows become context-bound.
- A transactional migration command now audits `batches`, `batch_keys` and `batch_key_material`, verifies already-bound envelopes against their database owner, and rewraps only historical v2 envelopes whose authenticated context is explicitly `unscoped`.
- The migration is dry-run by default. Database writes additionally require `--apply` and `NEXID_BATCH_KEY_MIGRATION_CONFIRM=REWRAP_UNSCOPED_V2`; output contains aggregate counts only and never keys or ciphertexts.
- This remains application envelope encryption backed by deployment secrets. It is not represented as managed KMS or HSM custody.

### Production maps and tenant risk stop manufacturing evidence

- Production `geoPoints` now contain only persisted event coordinates with a positive sample count and valid latitude/longitude range. A city label never becomes an invented event coordinate.
- Browser coordinates collected under the current consent flow are labelled as approximate; IP coordinates remain separately labelled and every point exposes its persisted-event provenance.
- The tenant stats API now returns the canonical `@product/core` risk score and breakdown from the explicit event taxonomy.
- The dashboard home and superadmin network consume that canonical score instead of maintaining two incompatible local weighting formulas.
- Demo fixtures remain available only on explicitly demo-labelled surfaces; they are not merged into production heatmaps.

### Human administration is bound to the authoritative IAM principal

- Every `checkAdmin` consumer now awaits the existing opaque database session resolver. Unknown, expired, revoked, disabled-user and stale-membership sessions fail closed.
- Role, tenant, permissions and audit actor come from the current session/user/membership rows. Caller-supplied authority headers and the global `ADMIN_API_KEY` no longer influence human admin authorization.
- Tenant admins and resellers are forced to their persisted tenant even when request input or forged headers select another tenant. Sensitive audit writers record the verified user ID/email.
- The dashboard generic proxy, realtime SSE proxy, tenant setup and internal demo proxy forward only the validated current/rotated session bearer. Demo sessions are served locally and never reach upstream admin endpoints.
- Clerk super-admin bootstrap now forwards a Clerk session JWT. The API verifies that JWT, loads the verified Clerk user, compares any claimed identity, and only then evaluates the explicit super-admin allowlist.
- Clerk bootstrap adds a distinct NULL-tenant super-admin membership under an advisory transaction lock and never rewrites an existing tenant membership. Role selection deterministically prefers that global membership.
- Session-secret rotation uses a hash compare-and-swap: one concurrent request can receive the new authoritative bearer and stale contenders fail closed instead of forwarding an already-invalid token.
- The unpersisted `security_operator` scope was removed. Sensitive supplier capabilities now require super-admin or explicit persisted permissions.
- The public Web3 bridge forwards only its Clerk session JWT; the API independently reloads the Clerk identity and verified wallet. Browser and dashboard routes no longer carry the ambient admin key.
- Public-certificate and SUN handoff HMACs have independent current/previous secrets. Legacy material is reachable only through explicit temporary migration gates; this does not change physical NFC keys or SUN cryptography.

This is locally validated code. Production still requires the paired rollout and canary order in `docs/security.md`; no environment variable, session, credential or deployment was changed here.

### SUN persistence and administrative tag lifecycle are fail-closed

- SUN verification keeps the existing NTAG 424 DNA SDM/CMAC and TagTamper path intact, but replay classification, counter mutation and required event persistence now share the database transaction and per-tag lock introduced by migration `0062`.
- Administrative lifecycle states are explicit: `inactive`, `active`, `suspended`, `quarantined`, `lost`, `expired`, `broken`, `tampered` and `revoked`.
- State transitions are tenant- and actor-scoped, compare-and-swap the revision, support idempotency and append immutable history.
- Activation cannot pass without at least one governed supplier sub-batch; an empty set is rejected instead of satisfying a vacuous aggregate.
- The SUN wrapper evaluates administrative status only after cryptographic verification and updates the exact partitioned event identity `(id, created_at)`. It does not replace or weaken CMAC, SDM, counter or TagTamper verification.
- Dashboard tag lists and passports expose lifecycle state, history and permission-gated controls without turning an administrative status into proof of physical authenticity.

### Supplier QA now derives SUN evidence server-side

- Supplier QA no longer trusts operator booleans, a claimed sample count or plausible raw SUN URLs. It accepts only bounded result-page references and resolves their diagnostics and canonical events server-side.
- A pass requires ten distinct manifest UIDs, CMAC/SDM/UID verification, exact tenant/batch/BID/counter/result binding and an event-linked same-counter replay for every selected UID.
- TagTamper additionally requires ten electronically decoded closed samples plus one later opened transition with a higher counter on a revoked sacrificial UID. Manual opened states cannot pass.
- The gate supports cryptographically verified pre-activation `NOT_ACTIVE` samples, so factory QA does not require making products market-active.
- Each qualifying scan now records an application-level `verification_context_digest` over the manifest, carrier/SDM configuration, authoritative pair fingerprint, supplier state, one-time export receipts and approved packaging revision. QA recomputes it from current authoritative rows and rejects a mismatch while avoiding raw UID and SUN query duplication in the QA/Vault artifact. This unkeyed database-resident digest is not a signature, WORM timestamp, KMS operation or HSM attestation.
- Order and batch carrier profiles must agree; the route uses the authoritative active `batch_keys` fingerprint, strictly parses the decision, bounds the request and notes, attributes the persisted IAM actor and prevents QA mutation after pass or activation.
- Migration `0070` makes the aggregate QA receipt idempotent and atomic: PostgreSQL locks and revalidates the supplier/batch context, globally claims every diagnostic once, and commits receipt, Vault metadata, statuses, evidence and audit together. The route has no request-path DDL or independent QA writes, and exact UI retries reuse the same `Idempotency-Key`.
- The lifecycle activation migration now uses the platform's canonical supplier QA value `passed`; the previous local `approved` mismatch would have blocked valid supplier activation.
- Public SUN operational logs no longer duplicate the raw decoded UID. The masked value is diagnostic only and remains pseudonymous.

This proves server-verified SUN evidence, not physical presence. The exact ceremony, privacy boundary, current limitations and two-stage trial/production target are documented in `docs/enterprise-hardening/2026-07-29/supplier-sun-qa-evidence-gate.md`.

### Canonical event, webhook and incident operations are durable

- Demo, ownership, warranty and tokenization actions use one canonical event writer instead of direct event inserts.
- The writer records the canonical event and webhook outbox in the same database transaction, stores the partition-safe source identity and binds idempotency to the complete persisted semantic operation.
- A repository gate rejects new direct `INSERT INTO events` paths outside the canonical migration/writer boundary.
- Webhooks now support history-preserving disable/delete, explicit reactivation, one-time server-generated secrets and rotation with a bounded dual-secret overlap.
- Delivery remains signed and is driven from the durable outbox; list/detail APIs do not expose stored secret material.
- The tenant-scoped event-to-incident flow persists incidents, linked tickets and append-only history, with SSE plus polling fallback and a dashboard evidence drawer.

### Tenant administration and external actions have narrower authority

- Global superadmin routes require the persisted `super_admin` role; tenant roles cannot select a global view with a header or query parameter.
- Leads and orders bind tenant, actor, bounded input, rate limit and idempotency at the API boundary.
- WhatsApp test delivery additionally requires the persisted permission, a valid E.164 destination, recorded consent, rate limiting and audit. No Twilio message was sent during this slice.
- Polygon wallet diagnostics now expose tenants only to capability, mode, network and availability. RPC/executor endpoints, signer configuration, contract/minter/recipient addresses and balances remain superadmin-only.

### Production surfaces no longer disguise fixtures or infrastructure claims

- The dashboard only serves CRM/demo fixtures during an explicit demo session and labels their source. Production views fail closed to unavailable/empty states instead of manufacturing zero-valued executive evidence.
- Consumer-network and heatmap clients reject demo payloads outside a demo session.
- Public, dashboard and documentation claims distinguish implemented code, historical staging evidence and currently verified runtime state.
- Software envelope encryption is consistently described as software custody. The code and product copy do not market Vercel environment variables, Cloudflare storage or application encryption as managed KMS/HSM.

### DemoLab preview no longer impersonates the physical NFC authority path

- Public and dashboard mobile demos display persistent simulation/preview banners and explicitly separate backend-reported demo data from synthetic seed content.
- The public preview no longer calls `/api/sun-context` or protected ownership, warranty and tokenization mutations. Those actions remain reserved for the canonical `/sun` flow and its short-lived server-issued handoff.
- Historical provenance remains a read-only query; tokenization from the preview is only a commercial-interest lead and cannot create a chain request.
- Demo maps use vertical-specific illustrative origins, lazy-load the heavy 3D runtime and label routes, GPS, metrics and trust scores as illustrative rather than physical evidence.
- Local browser persistence is versioned and allowlisted to event type plus timestamp. Legacy DemoLab keys are purged, and email, name, company, country, role, free text, coordinates and server errors are not persisted. Optional preview GPS is requested in low-accuracy mode and rounded to three decimal places at collection time.
- The dashboard duplicate now publishes `evidenceSource` and `physicalTapVerified: false`, removes `LIVE TAP`/`SCAN PULSE`, and disables sensitive CTAs instead of presenting inert controls as functioning actions.

The complete boundary, data-minimization contract and external proof gates are documented in `docs/enterprise-hardening/2026-07-29/demo-preview-physical-boundary.md`.

### Secret custody and release gates are explicit

- Local NFC provisioning helpers default to an ignored `.nexid-custody` path instead of repository-visible output locations.
- The tracked-secret gate rejects NFC custody artifacts and recognized live-secret formats before release.
- The database release watermark and dry-run/preflight tooling now cover migrations `0057` through `0071`, including SUN atomic persistence, supplier packaging governance, webhook lifecycle, incidents, tag lifecycle, the canonical event outbox, the GS1/EPCIS foundation, atomic Supplier QA receipts and fail-closed supplier pack-purpose governance. The enum-only `0068` must commit before `0069`; `0070` materializes durable SUN diagnostics and the QA writer; `0071` prevents an integration receipt from being treated as commercial release.
- Migration safety checks assert transaction ownership, durable tables/functions, the non-empty supplier activation gate, composite partition identity and atomic event/outbox semantics.

These controls are implemented and locally verified. They are not evidence that migrations `0062` through `0071` have been applied to production, that the QA or pack-purpose functions passed a real PostgreSQL concurrency/rollback test, that a live webhook worker or chain executor has processed an event, or that a physical NFC sample has passed the complete deployed path.

## Verified evidence

- API TypeScript check: pass.
- Dashboard TypeScript check: pass.
- Web TypeScript check: pass.
- Next dynamic-route conflict check: pass.
- Final API authorization/security regression: 100/100 pass.
- Final API route regression: 2/2 pass.
- Final dashboard suite: 254/254 pass.
- Final web suite: 236/236 pass.
- Focused GS1 resolver tests: 9/9 pass.
- E2E harness safety tests: 5/5 pass.
- Approximate-location privacy tests: 5/5 pass.
- Supplier/key-custody, SUN QA atomicity contracts and packaging-governance security tests: 68/68 pass.
- Batch envelope migration missing-config and missing-apply-consent gates: pass.
- Canonical analytics/risk/tenant-isolation contract tests: 26/26 pass.
- Dashboard analytics source and canonical risk contract tests: 5/5 pass.
- SUN and administrative lifecycle focused tests: 67/67 pass.
- Webhook signature, outbox and lifecycle focused tests: 49/49 pass.
- Polygon transfer controls: 24/24 pass.
- Polygon/IOTA proof validation: 48/48 pass.
- Polygon wallet disclosure boundary: 11/11 pass.
- Fleet rate-limit policy: 44/44 pass.
- Migration/preflight and GS1/EPCIS contract tests: final focused counts recorded in the 2026-07-29 GS1/EPCIS handoff.
- Focused dashboard proxy/session/demo authorization tests: 29/29 pass.
- Secret-custody gate: 1,611 tracked files checked; no recognized tracked live-secret format or NFC custody output found.
- Dependency audit: 0 known production vulnerabilities across 343 production dependencies at the time of this run.
- Migration safety gate: 21 release migrations reviewed, with all structural assertions passing.
- Unsafe default harness invocation: rejected before database or network initialization.
- Focused DemoLab preview/storage/heavy-import contracts: 11/11 pass.

No batch envelope migration, staging or production mutation, deployment, physical NFC scan or GS1 external conformance run was performed.

The read-only preflight against the database currently configured in `apps/api/.env.local` did not authorize a release. The normal run stopped because `SDK_IDEMPOTENCY_MASTER_KEY_HEX` is not configured. A process-only diagnostic value was then used solely to reach the read-only schema checks; that historical check reported migrations/functions for `0062` through `0067` as absent. Migrations `0068` through `0071` were authored afterward and have not been applied. No key was persisted and no database write was made. This configured target must not be called production-ready until the real release secret is provisioned through the approved secret manager and the migration plan completes its fingerprint, backup, apply and post-check gates.

## Prioritized remaining work

### P0 — controlled database release

1. Provision a real `SDK_IDEMPOTENCY_MASTER_KEY_HEX` and version identifier through the approved deployment secret manager; never place them in Git, chat, logs or migration output.
2. Confirm the exact target database and change window, capture the release fingerprint and backup/restore evidence, then run the fail-closed dry-run for `0062` through `0071`.
3. Apply the migrations only after explicit production authorization, and require the post-checks for functions, constraints, indexes, ledger watermark and rollback readiness to pass before traffic proceeds.

### P0 — factory trial and QA release boundary

1. Persist the explicit manufacturing state machine `DRAFT_SPEC -> TRIAL_PACK_APPROVED -> TRIAL_10_ENCODED -> TRIAL_QA_PASSED -> PRODUCTION_PROVISIONED -> PRODUCTION_PACK_RELEASED`.
2. Split trial from production with dedicated BIDs/keys, bounded trial quantity and no promotion of trial key material.
3. Add an expiring QA session with server-selected manifest UIDs and a customer-quality-approved AQL/stratified receiving policy. The fixed ten-tag ceremony remains integration evidence, not lot acceptance.
4. Prove migration `0070` against disposable PostgreSQL with double-pass, pass-versus-activation, diagnostic-reuse, exact retry and forced rollback tests, then run deployed staging smoke.
5. Version/domain-separate the scan-time context digest, bind the future `pack_purpose`/manufacturing state/QA-session commitment and independently anchor the receipt where required. The current database-resident SHA-256 binding is not a signature or HSM attestation.
6. Run the real 10/11-tag TT ceremony on production-like staging before releasing any customer pilot.

### P1 — external runtime evidence

1. Exercise webhook create/rotate/overlap/delivery/disable/reactivate against an isolated staging worker and record signed-delivery receipts without exposing secrets.
2. Run the tap → canonical event → tenant SSE/polling → incident → linked ticket journey in browser E2E with an ephemeral database.
3. Validate Polygon Amoy and IOTA publication through their configured executors and independent proof readers. Local fixtures and historical staging evidence are not a fresh live-chain certification.
4. Validate the consent-gated WhatsApp path with a dedicated test recipient before enabling any customer-facing send.

### P2 — standards, physical proof and SLOs

1. Validate the registry-backed resolver against the normative schemas and official test-suite gate on deployed HTTPS domains.
2. Extend the bounded EPCIS/CBV 2.0 foundation with normative JSON Schema/SHACL validation and the required query, subscription and master-data surface.
3. Measure end-to-end latency/error SLOs and define alert/runbook ownership for SUN, event, webhook and chain queues.
4. Run the ten physical NTAG 424 TT samples through the production-like staging path, preserving the current cryptographic keys and documenting each expected counter/tamper outcome.
