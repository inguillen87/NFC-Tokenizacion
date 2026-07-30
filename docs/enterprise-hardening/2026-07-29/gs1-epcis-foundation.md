# GS1 Digital Link registry and EPCIS/CBV 2.0 foundation

Date: 2026-07-29

## Verdict

This increment implements a tenant-scoped GS1 Digital Link registry and a bounded EPCIS/CBV 2.0 capture, query and export foundation over NexID's canonical event and webhook outbox model. It is locally validated code. It has not been applied to a database, deployed, exercised against production traffic or certified by GS1.

The physical NFC path is unchanged. NTAG 424 DNA SUN/SDM/CMAC and TagTamper verification remain the only physical-tag cryptographic path. A registered GS1 identifier or captured EPCIS business event is identity/business evidence; neither is represented as NFC cryptographic authentication.

## GS1 Digital Link registry

The registry stores an exact tuple of GTIN-14, optional AI 10 lot and optional AI 21 serial. Every row is bound by database foreign keys to one tenant and batch, and optionally one tag. GTIN check digits and bounded path-safe qualifiers are enforced in both TypeScript and PostgreSQL.

Public path ownership is platform-wide and permanent across `active`, `suspended` and `retired` states. Suspending or retiring an identity cannot release it for takeover by another tenant. Public resolution returns only exact `active` matches:

- malformed syntax: `400`;
- syntactically valid but unknown, suspended or retired identity: `404`;
- ambiguous or unavailable registry: fail closed with `503`;
- exact active identity: the server-owned tenant, batch and registry ID are injected into the resolver target; caller-supplied scope is discarded.

Administration is principal- and tenant-scoped:

- `GET /admin/gs1/identities` uses bounded keyset pagination by `(updated_at, id)` and returns `nextCursor`;
- `POST /admin/gs1/identities` registers an exact identity and provides natural replay/conflict semantics;
- `PATCH /admin/gs1/identities/{id}` uses compare-and-swap status changes with append-only audit;
- allowed changes are `active -> suspended|retired` and `suspended -> active|retired`; `retired` is terminal;
- an exact repeated desired state is an idempotent replay and does not append duplicate audit history.

GTIN prefix authority is a separate platform governance boundary. A tenant
administrator cannot self-assert that it owns a GS1 prefix and the identity
registration body does not accept authority fields. Only a `super_admin`
principal can use:

- `GET /admin/gs1/entitlements` to list the platform registry with bounded
  keyset pagination;
- `POST /admin/gs1/entitlements` to grant a prefix after recording one of the
  bounded verification methods and a reference to reviewed evidence;
- `PATCH /admin/gs1/entitlements/{id}` to revoke an active entitlement using a
  compare-and-swap request.

The evidence reference is governance metadata, not uploaded evidence or key
material. Grants and status changes are written with append-only audit rows in
the same database transaction. Prefix overlap is rejected globally, tenant
ownership is enforced by UUID foreign keys plus tenant-coordinate triggers, and a revoked entitlement is
not transferable through this API. Public resolution and EPCIS capture both
require the entitlement to remain active. The atomic capture function locks the
identity and entitlement rows while projecting the document, closing the race
between revocation and capture.

The resolver treats an active registry result as a live authorization decision
and therefore returns `Cache-Control: no-store, max-age=0, must-revalidate`.
Revocation or suspension is never intentionally hidden behind a shared CDN
cache. Step-up MFA remains a production release requirement for entitlement
writes, but it is not claimed or enforced by these routes until the encrypted,
server-bound MFA enrollment and challenge flow exists. The legacy plaintext
TOTP path remains disabled rather than being re-enabled as a cosmetic control.

The web resolver has no implicit localhost or production API fallback. `NEXID_GS1_REGISTRY_API_URL` must be configured explicitly and must be HTTPS in production. Without that configuration, registered resolution fails closed with `503`.

## EPCIS/CBV bounded profile

Server SDK routes:

| Route | Scope | Contract |
| --- | --- | --- |
| `POST /api/v1/sdk/epcis/capture` | `sdk:epcis:write` | Atomic capture with required `Idempotency-Key` |
| `GET /api/v1/sdk/epcis/events` | `sdk:epcis:read` | Tenant-scoped keyset query |
| `GET /api/v1/sdk/epcis/export` | `sdk:epcis:read` | One bounded EPCISDocument page |

Capture accepts `application/vnd.gs1.epcis+json`, `application/ld+json` and `application/json`. It requires the immutable official EPCIS JSON-LD context and `schemaVersion: 2.0`. The supported event types are `ObjectEvent`, `AggregationEvent`, `TransactionEvent`, `TransformationEvent` and `AssociationEvent`, with type-specific identifier shape checks. Bare supported CBV business-step and disposition terms are normalized to `https://ref.gs1.org/cbv/...` URIs.

Hard limits are:

- 512 KiB per document;
- 100 events per document;
- 64 KiB per event;
- 100 identifiers per event;
- 100 canonical projections per capture;
- 200 events per query/export page;
- 2 capture requests per minute in a tenant-wide admission bucket, in addition
  to the principal and pre-authentication source limits. This conservative
  default is an amplification guard, not a contractual throughput promise.

Every EPCIS identifier must be an exact HTTPS GS1 Digital Link tuple already active in the caller's tenant registry. The database function rechecks tenant ownership, API-key state and registry status inside the transaction. It then writes the capture operation, document, EPCIS events, identifier links, canonical event projections and matching webhook outbox rows as one all-or-none transaction.

The idempotency fingerprint binds the tenant and normalized document. Reusing a key with the same document returns the original receipt. Reusing it with different semantics returns `409`. Duplicate client `eventID` values inside a tenant return `409`. Returned event and projection counts must exactly match the validated request.

Canonical projections use `epcis.event.captured`, evidence level `declared_business_event` and `cryptographic_authentication: false`. They do not call or modify the SUN persistence function.

Query/export filters are a bounded subset: event type, business step, disposition, GTIN/lot/serial and event-time range. Pagination is keyset-based by `(event_time, id)`; no offset or unbounded export is provided.

## Release order

The schema change is intentionally split:

1. `20260729110000_0068_epcis_event_type.sql` adds the canonical event enum label and must commit.
2. `20260729110500_0069_gs1_epcis_foundation.sql` creates the registry, EPCIS storage and capture writer.

This separation is required by PostgreSQL because a new enum value cannot be used until the transaction that adds it commits. The capture function stores the label as text and casts it only when the function runs after the real migration commit, so the rollback-only multi-migration dry-run does not convert an uncommitted enum value.

Safe rollout sequence:

1. run preflight, target fingerprint, backup/restore evidence and rollback-only dry-run;
2. query `schema_migrations` in every shared environment and require `0069` to
   be absent before applying this local definition; if it is already present,
   stop and ship a forward migration instead of rewriting history;
3. apply `0068` and `0069` with the reviewed migration runner;
4. register every existing GS1 demo/sample/customer identity through the tenant-scoped admin API;
5. deploy the API and verify known/unknown/suspended resolver responses;
6. set the web service's explicit `NEXID_GS1_REGISTRY_API_URL` and deploy resolver enforcement;
7. execute isolated capture/replay/conflict/query/export/webhook smoke tests before customer traffic.

`0069` deliberately does not build new composite unique indexes on the active
`batches`, `tenant_api_keys` or `canonical_event_operations` tables. Their UUID
primary keys provide referential existence and delete semantics; database
triggers lock the referenced rows, enforce the matching tenant coordinate and
reject reparenting once a GS1/EPCIS child exists. This keeps the existing
transactional migration runner fail-fast without pretending that PostgreSQL can
run `CREATE INDEX CONCURRENTLY` inside its transaction.

Deploying the web enforcement before registering existing GS1 identities would intentionally turn those GS1 URLs into `404`; omitting the explicit API origin would return `503`. The NFC SUN sample URLs are independent and remain unchanged.

## Explicit remaining gaps

This is not full EPCIS 2.0 or GS1 Resolver certification. Before making that claim NexID still needs:

- validation against the complete official EPCIS JSON Schema and SHACL artefacts;
- the full standard query vocabulary and subscription interfaces where commercially required;
- EPCIS master-data/header support beyond this bounded event profile;
- resolver language/context/link-management behavior required by the chosen conformance profile;
- official GS1 conformance suites against the deployed HTTPS domains;
- an integration test on an isolated PostgreSQL database that executes `0068` and `0069`, followed by remote staging receipts.

Official references used for the contract:

- [GS1 Digital Link Resolver Standard 1.2](https://ref.gs1.org/standards/resolver/)
- [GS1 EPCIS Standard 2.0.1](https://ref.gs1.org/standards/epcis/2.0.1/)
- [GS1 EPCIS 2.0 artefacts](https://ref.gs1.org/standards/epcis/artefacts)
- [GS1 Core Business Vocabulary 2.0](https://ref.gs1.org/standards/cbv/2.0.0/)

## Local evidence

At handoff, the following local evidence passed:

- GS1/EPCIS, entitlement-authority and OpenAPI focused contract tests: 12/12;
- API authorization/security regression: 107/107;
- distributed rate-limit regression: 46/46;
- enterprise release and migration-safety contract through `0069`: pass;
- API TypeScript and App Router route checks: pass.

The web registry resolver and dashboard SDK checks recorded earlier in this
worktree were not rerun as part of this backend-only boundary increment.

No migration, deployment, physical NFC operation, webhook delivery, PostgreSQL integration execution or remote conformance test was performed.
