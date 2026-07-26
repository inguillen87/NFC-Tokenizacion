# nexID enterprise product experience sprint

Date: 2026-07-26

## Outcome

This sprint raises the product's operational and developer experience without
changing the physical NFC cryptographic path. It focuses on the places where a
pilot, a small integrator and an enterprise operator need different levels of
guidance while still seeing the same underlying evidence.

The work does **not** claim an unmeasured "30x" improvement. That claim needs a
baseline and user telemetry. Instead, this document records concrete product
contracts, test evidence and the metrics required to prove improvement after
rollout.

## Product stories covered

| Story | Implemented outcome | Truth boundary |
| --- | --- | --- |
| Small integrator makes a first API call | Guided tenant -> scoped key -> real verify request; copyable server-side cURL and Node examples | No browser key exposure and no invented public sandbox |
| Enterprise manages credentials and webhooks | Least-privilege profiles, expiry, one-time secret, revocation confirmation, signed webhook setup and delivery diagnostics | No redelivery button because no redelivery endpoint exists |
| Operator watches field activity | Existing SSE events drive map and CRM; explicit connecting, live, stale, reconnecting and degraded states | Missing upstream data is never rendered as zero activity |
| Operator explores geographic risk | Heatmap, clusters, nearby mode, accessible textual summary and WebGL fallback | A map point represents received event coordinates, not continuous GPS tracking |
| Consumer taps wine, seed, chemical or logistics packaging | Vertical-specific next step, explicit custody/ownership action and safe problem path | A tap alone never transfers ownership or custody |
| Buyer evaluates blockchain capabilities | Guided IOTA/Polygon lab organized by audit, ownership or combined objective | TESTNET is persistent; RPC/receipt/mint evidence controls status |
| Commercial buyer estimates a pilot | Editable vertical presets, encoded tag cost, platform cost, incident exposure and event/anchor cadence | It is a planning model, not a quote; gas is not invented |

## High-impact changes

### Administration, CRM and maps

- Shared loading, empty, warning and error states with ARIA live semantics.
- Dashboard route-level loading and recoverable error boundaries.
- Analytics distinguishes valid zero activity from invalid payload, upstream
  error and unreachable source.
- CRM shows partial-source availability and SSE freshness instead of silently
  flattening failures into empty arrays.
- Live map has WebGL failure fallback, cooperative gestures, reduced-motion
  handling and a textual geographic summary.
- The global sidebar no longer fabricates `30%`, `3 of 10 batches`, `Stream
  Live` or `120 TPM`. Until trusted billing/realtime props exist, it links to
  Billing and Analytics for the authoritative state.

### Developer Hub and SDK onboarding

- Integration profiles for pilot/small business, commerce and enterprise
  supply chain, each with a strict subset of scopes.
- First-call readiness is based on tenant, active key and observed request;
  webhooks are correctly optional for simple integrations.
- Demo or unscoped fallback responses remain visibly labelled, read-only and
  score `0/3`; they cannot be mistaken for tenant production readiness.
- Tenant changes abort the previous request, clear prior rows and reject late
  responses so one tenant's credentials cannot flash into another context.
- API keys gain purpose, expiry, one-time secret handling and explicit
  revocation consequences.
- Webhook signing secret is mandatory and delivery state exposes HTTP status,
  attempts, next retry, event ID and sanitized errors.
- The private TypeScript server SDK now provides typed failures, correlation
  IDs, timeouts, cancellation and safe retries only for operations protected by
  durable server-side idempotency. Verify, claim, events and POS activation use
  a canonical tenant/route/body hash, encrypted exact replay, immutable payload
  matching, `409` on key reuse with different input, explicit status/reconcile
  and outbox repair. The encryption envelope has a KID and previous-key ring so
  replay records survive controlled key rotation.
- The SDK is consumable as a real Node 20 ESM package with JavaScript,
  declarations, source maps, explicit exports and a packed-tarball install
  smoke. It remains private and was not published to a registry in this sprint.
- New webhook endpoints default to signature envelope v2. The v2 HMAC covers
  version, timestamp, key ID, delivery ID, event ID, raw-body length and exact
  raw-body bytes; receivers enforce a 300-second replay window and constant-time
  comparison. Existing endpoint rows are backfilled to v1 before the v2 default
  is applied, so the migration does not silently break legacy receivers.
- Version v1 remains accepted only for compatibility. Its key ID is explicitly
  unauthenticated and must not be used by a receiver to select secrets; v2
  authenticates the key ID and prevents that ambiguity.

### Post-tap journeys

- Wine and generic consumer products may expose loyalty and optional digital
  ownership actions.
- Seeds focus on origin, lot, purchase and evidence retention.
- Chemicals put seal/identity safety and incident reporting before commercial
  actions.
- Logistics focuses on route, event review and explicit operational receipt.
- Pharma copy states that the evidence does not replace clinical, regulatory
  or quality controls.
- A stale snapshot or non-fresh tap cannot invoke protected actions.

The product passport no longer fabricates sensor history. It now renders one of
three states: reported snapshot, clearly labelled Demo Lab data or no telemetry.
Wine tasting profiles and distinctions are either producer data or explicitly
labelled simulation; real awards are never inferred.

The SUN demo also uses one canonical origin-to-current-tap route across the map,
metrics and event story. The browser regression found and removed a 146 km
intermediate-leg mismatch; the Bodega Balmec to Buenos Aires demo now reports
1,003 km consistently.

### Chain Lab and commercial calculator

- `/demo-lab/chains` explains IOTA integrity evidence and Polygon ownership as
  separate jobs, then lets a non-technical user inspect the live public proof.
- Status is `verified`, `partial`, `configured` or `unavailable`; configuration
  alone cannot become verified.
- The pricing model includes tags and platform/deployment in first-year cost.
- NFC verification is explicitly separated from blockchain anchoring.
- Operational events, IOTA aggregation cadence and optional Polygon ownership
  actions can be changed independently or disabled, so a 200,000-tag program
  is not priced as 200,000 blockchain writes.
- Results are explicitly a modeled subtotal. Freight, tax, financing,
  production gas and unentered scope are excluded and remain quote inputs.

## Benchmark applied

- atma.io: connected-product identity and lifecycle visibility.
- Kezzler: traceability, compliance and dynamic post-scan engagement.
- Scantrust: scan analytics and geographic reporting.
- Stripe Workbench and key guidance: time to first request, one-time secrets,
  least privilege and webhook observability.
- GitHub webhooks: delivery-level troubleshooting patterns.
- GS1 Digital Link and traceability: one identity connected to multiple
  resources and interoperable event semantics.
- MapLibre and ArcGIS Dashboards: map interaction and operational summaries.
- W3C WCAG/WAI-ARIA: status semantics, keyboard operation and reduced motion.

## Local and package verification evidence

- Web tests: 221/221 passed, including pricing-input synchronization, vertical
  post-tap truth, Chain Lab evidence and SUN route-distance regressions.
- Dashboard tests: 229/229 passed, including tenant boundaries, map provenance,
  realtime degradation, SDK DX, MFA fail-closed and tokenization permissions.
- SUN/NFC regression group: 57/57 passed.
- Private server SDK source tests: 15/15 passed; strict TypeScript and package
  build passed; Node 20 ESM consumer smoke: 1/1 passed; packed tarball installed
  and imported successfully in an isolated consumer.
- API authentication/security group: 88/88 passed; Polygon group: 24/24;
  public CTA fresh-handoff group: 15/15; rate-limit group: 43/43.
- Webhook delivery/signature API group: 39/39 passed, including v1 compatibility,
  v2 canonical framing and the no-downgrade contract.
- Executor tests: 88/88 passed. Cloud Build repeated install, syntax checks,
  the complete executor suite and the container build before publishing.
- Static QA, `git diff --check`, production dependency audit and high-signal
  secret scan passed. `npm audit --omit=dev` found zero vulnerabilities.
- Migration-safety checks passed through `0061`. Production Neon received
  `0060` (durable SDK idempotency) and `0061` (encrypted supplier export
  delivery) transactionally after a rollback-only rehearsal and target
  fingerprint check.
- Web TypeScript and production build passed; 55 pages generated and
  `/demo-lab/chains` registered.
- Dashboard TypeScript and production build passed; 74 pages generated.
- API TypeScript and production build passed; 25 application pages/routes were
  generated after route, rewards, Polygon, wallet, IOTA proof, webhook,
  authentication and rate-limit suites passed.
- Desktop and 390 px browser review passed for Chain Lab, pricing, SUN,
  Dashboard, maps/CRM and Developer Hub; modified pages showed no horizontal
  overflow at 390 px.
- The finalized Chrome QA profile under `.codex-run-logs` was deleted after
  review (1,055 generated files, about 56.9 MB) so copied cookies, history and
  login data cannot enter a handoff archive. Source scan artifacts were also
  removed.

## Production deployment and browser evidence

Production aliases were checked against Vercel after each target reached
`Ready`; a successful build command alone was not treated as deployment proof.

| Surface | Production deployment | Canonical URL | Post-deploy evidence |
| --- | --- | --- | --- |
| API | `dpl_FZtSgLMkmL4yMoNp7DJJXscQaK4i` | `https://api.nexid.lat` | `/health`, `/public/proof/demo-cases` and `/public/polygon/ownership` returned HTTP 200; IOTA and Polygon reported RPC-confirmed evidence; invalid SDK input returned 401; `/marketplace/products` returned 200 and exercised the production DB/watermark path |
| Dashboard | `dpl_2zW2KQgFDK6rc4XYWi7pd6EP2Dmf` | `https://app.nexid.lat` | Authenticated tenant session, analytics heatmap/source/GPS boundary, realtime and degraded states, logistics, Developer Hub, subscriptions, access denial for global tenants, MFA fail-closed and mint-versus-transfer copy passed in Chrome without page error or horizontal overflow. The final deployment removes fabricated sidebar usage and live-stream metrics; canonical critical routes returned HTTP 200. |
| Web | `dpl_DeZFartrQtnWGB9KosgBYdNUf2Qs` | `https://nexid.lat` | SUN post-tap, seed Demo Lab, motion pack, Chain Lab, stack, glossary, SDK, docs, investor snapshot, pricing and landing passed in Chrome without page error or horizontal overflow. The public SDK page exposes `Idempotency-Key`, safe-retry, `409` payload-conflict, status/reconcile and webhook-signature-v2 contracts. Compliance, transfer/sale and webhook-latency copy is conditional; NFT is a request until receipt evidence and Chain Lab explicitly performs no transfer/payment/settlement. Canonical critical routes returned HTTP 200. |

The executor image was built by Cloud Build
`bc17df74-4a0e-4549-a165-aeff14493d42` with digest
`sha256:50d81c664c8a2a013e11ad0742e95b3b248366bb103f586993a4dfbff159a84d`.
Cloud Run serves 100% from `nexid-chain-executor-stg-00007-dig` and
`nexid-iota-executor-stg-00005-for`. Candidate and canonical smokes returned
health 200, authenticated readiness `ok=true`, unauthenticated mutation 401 and
zero `severity>=ERROR` entries. Polygon readiness verified Amoy chain 80002,
contract bytecode, authorized signer and gas; IOTA readiness verified its
contract configuration and durable PostgreSQL store.

The blockchain signer mode is `kms_wrapped` using Google Cloud KMS **SOFTWARE**
envelope encryption. The private wallet material is encrypted at rest and
decrypted transiently inside the executor. This is not HSM and not direct
non-exportable signing. The NFC/SUN path remains separate: Neon stores encrypted
batch key envelopes and the Vercel application secret decrypts them; it was not
migrated to Google KMS in this release so the physical samples remain compatible.

## Measurement plan

The following metrics are required before any comparative claim such as
"30x better" can be used externally:

1. Median time from API key creation to first successful `/sdk/verify` call.
2. First-call completion rate without support intervention.
3. Webhook setup completion and signed-delivery success rate.
4. Median time to diagnose a failed delivery from the Developer Hub.
5. Post-tap next-action completion by vertical and outcome.
6. Rate of users who mistake a tap, testnet receipt or configured signer for a
   completed ownership/production action.
7. CRM event freshness, reconnect frequency and percentage of time in degraded
   state.
8. Map interactions that lead to a filtered operational investigation.
9. Pricing-model-to-qualified-pilot conversion, segmented by scenario.
10. Accessibility and mobile task completion at 390 px and desktop widths.

## Remaining product gates

- A physical tap of the ten NTAG 424 TT samples remains a human hardware test.
- Map locations are event-driven and are not continuous asset GPS unless a
  tenant integrates a live positioning source.
- The chain lab proves current testnet evidence. It is not mainnet readiness or
  a regulated SLA.
- Polygon production currently supports verified mint evidence. Generic ERC-721
  transfer and P2P payment/settlement are not implemented; purchase remains a
  request and `p2p/buy` fails closed. A safe future MVP needs a dedicated
  claim-release executor, EIP-712 consent, durable outbox/receipt/finality and
  historical owner verification.
- `SUN_AUTO_TOKENIZE_ON_VALID_TAP=false`: NFC reads do not create one blockchain
  transaction each. Tokenization is milestone/request-driven. No automatic
  retry is promised until an authenticated scheduler/worker is configured and
  smoked.
- Cloud Run currently accepts public network invocation and enforces dedicated
  application secrets. Service-to-service IAM/OIDC with a minimal invoker role
  remains the stronger production target.
- Live OCR provider capacity, a real signed-webhook receiver/replay canary, SDK
  registry publication governance, external security-scan completion, mainnet
  operations and customer SLA evidence remain promotion gates.
- Real customer policy, assets, copy, safety documents and permissions still
  need tenant onboarding before a pilot can be called production-ready.
- The deployed Vercel IDs and Cloud Run image digest identify immutable runtime
  artifacts, but the current broad source workspace is not yet a clean Git
  release unit. Before a team handoff or external audit, the owner must review
  the pre-existing dirty tree and create an approved commit/tag or PR; this
  sprint intentionally did not stage or commit unrelated user changes.
- The software and browser gates for this release are complete. They do not make
  the whole platform "enterprise final" while the physical, custody, transfer,
  external-provider, mainnet and SLA gates above remain open.
