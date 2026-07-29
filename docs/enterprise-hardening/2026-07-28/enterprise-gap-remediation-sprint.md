# Enterprise gap remediation sprint — 2026-07-28

## Executive verdict

NexID already has a credible product surface: SUN/SDM verification, normalized event contracts, tenant-aware SSE, analytics, maps, SDK/API keys, signed webhook delivery, public proof labs and mobile post-tap experiences. It is not yet correct to call the whole platform enterprise-complete. The remaining gaps are concentrated in identity-bound administration, atomic SUN persistence, privacy defaults, operational incident handling, standards conformance and production evidence.

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

This is a standards-aligned foundation, not a claim of full GS1-Conformant Resolver certification. Full conformance still requires a product/link registry that returns `404` for syntactically valid but unknown identifiers, language/context selection, validation against the normative schemas and a passing run of the official GS1 Resolver 1.2 test suite on the deployed HTTPS domain.

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

## Verified evidence

- API TypeScript check: pass.
- Web TypeScript check: pass.
- Next dynamic-route conflict check: pass.
- Web test suite after the resolver and auth changes: 228/228 pass.
- Focused GS1 resolver tests: 8/8 pass.
- E2E harness safety tests: 5/5 pass.
- Approximate-location privacy tests: 5/5 pass.
- Supplier/key-custody and packaging-governance security tests: 51/51 pass.
- Batch envelope migration missing-config and missing-apply-consent gates: pass.
- Canonical analytics/risk/tenant-isolation contract tests: 26/26 pass.
- Dashboard analytics source and canonical risk contract tests: 5/5 pass.
- Focused authoritative admin-principal, Clerk, wallet, tenant isolation, rate-limit, signing-secret, E2E safety and special-route tests: 74/74 pass.
- Focused dashboard proxy/session/demo authorization tests: 29/29 pass.
- Unsafe default harness invocation: rejected before database or network initialization.

No batch envelope migration, staging or production mutation, deployment, physical NFC scan or GS1 external conformance run was performed.

## Prioritized remaining work

### P0 — security and truth

1. Make replay classification, tag counter/state mutation and canonical TapEvent persistence one database transaction under a per-tag lock; required persistence must fail closed.

### P1 — enterprise operations

1. Build the tenant-scoped tap-to-incident loop: SSE with polling fallback, event drawer, evidence explanation, real linked ticket and immediate CRM update.
2. Add lifecycle states and semantics for revoked, broken, tampered, lost, expired and quarantined tags without changing SUN cryptography.
3. Route demo, ownership, warranty and tokenization actions through the canonical event writer/outbox.
4. Replace fixture-backed superadmin/CRM metrics with live APIs and explicit empty states.
5. Add soft-disable/history-preserving webhook deletion and dual-secret rotation overlap.

### P2 — standards and proof

1. Add the GS1 link registry, normative schema validation and official test-suite gate.
2. Implement EPCIS/CBV 2.0 capture, query and export over the canonical event model.
3. Add browser E2E against an ephemeral database for tap → persisted event → tenant SSE → analytics → incident ticket.
4. Measure the end-to-end latency SLO and run physical NTAG 424 TT samples through the production-like staging path.
