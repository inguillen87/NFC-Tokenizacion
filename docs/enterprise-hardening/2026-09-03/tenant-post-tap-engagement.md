# Tenant post-tap engagement projection

## Delivered boundary

`GET /admin/engagement` is a read-only, tenant-scoped CRM projection. It does not create an engagement database or infer activity from a UID. It reads the durable records already owned by the platform:

| Domain | Stage | Durable source | Meaning |
| --- | --- | --- | --- |
| `passport` | `VIEWED` | `sdk_external_events` / `PRODUCT_VIEWED` | The public passport client reported the view and the API recorded it. |
| `content` | `VIEWED`, `STARTED`, `CONFIRMED` | `sdk_external_events` | A supported content action was recorded. Client-originated confirmation remains labelled as client-reported provenance. |
| `warranty` | `STARTED` | canonical `events` / `WARRANTY_REVIEW_REQUESTED` | The review request was durably recorded; warranty is not approved. |
| `warranty` | `CONFIRMED` | canonical `events` / `WARRANTY_REGISTERED` | The source workflow recorded a warranty registration. |
| `support` | `STARTED` | `sdk_external_events` / supported request events | The public client reported starting a support/contact action. |
| `support` | `CONFIRMED` | `tickets` / `sun_public_report` | A durable support ticket exists; the issue is not necessarily resolved. |
| `ownership` | `CONFIRMED` | `consumer_product_ownerships` with `status=claimed` | The nexID off-chain ownership registry has a claimed record. It does not prove physical custody or an on-chain transfer. |
| `loyalty` | `VIEWED` | `sdk_external_events` / `LOYALTY_OFFER_VIEWED` | The public client reported viewing the offer. |
| `loyalty` | `CONFIRMED` | `loyalty_members` with `status=enrolled|verified` | A durable loyalty membership exists. It is not marketing consent. |

`CONFIRMED` always means that the named source system durably recorded that workflow step. It does not mean warranty approval, support resolution, physical authenticity, custody, identity verification, or permission to contact.

## Tenant and identity rules

- Tenant-bound admin sessions always use their persisted tenant. A super-admin must select one explicit tenant; there is no global fallback.
- Every source branch filters by the resolved tenant UUID, and source-tap joins also include the same tenant UUID.
- BID, tag ID and tap event ID remain product/evidence references. They are never actor identifiers.
- `actor.consumerId` is returned only when the activity resolves to exactly one durable consumer link and that consumer has at least one current consent row with `granted=true`, a non-null `granted_at`, no `revoked_at`, and an allowed contact scope.
- Ticket contact text and loyalty-member email/phone fields are not projected as CRM identity.

## API contract

Required permission: `crm:read`.

Filters:

- `tenant`: required for super-admin; ignored in favor of the persisted tenant for tenant-bound sessions.
- `range`: `24h` by default; allowed values are `24h`, `7d`, and `30d`.
- `domain`: one of `passport`, `content`, `warranty`, `support`, `ownership`, `loyalty`.
- `stage`: one of `VIEWED`, `STARTED`, `CONFIRMED`.
- `source`: `real`, `demo`, `imported`, `unknown`, or `all`.
- `limit`: 1 through 500, default 100.

The response keeps `real`, `demo`, `imported`, and `unknown` separate. Missing source evidence remains `unknown`; the endpoint does not manufacture a production classification. Summary buckets are explicitly scoped to returned items, while `totals.matched` reports the full filtered window.

## Writer hardening

The existing public experience writer remains the only writer for public passport activity. It now:

- derives tenant, batch, tag and BID from the server-loaded source tap context;
- scopes its transaction advisory lock by tenant plus idempotency key;
- fingerprints tenant, source tap, event type, idempotency key, taxonomy and sanitized semantic payload;
- rejects reuse of the same key for a different event or payload, including legacy rows without a stored fingerprint;
- writes the activity and an `audit_logs` receipt in the same serializable statement;
- stores taxonomy version and provenance without accepting arbitrary contact or identity fields.

There is no database migration in this increment. Idempotency is guaranteed when callers use the canonical application writer; direct out-of-band inserts into `sdk_external_events` remain outside that guarantee.

## Verification boundary

The focal tests validate taxonomy mapping, request fingerprints, writer SQL, atomic audit intent, exact tenant predicates, consent gates, real/demo/unknown separation, missing-data behavior, the route contract, and OpenAPI. TypeScript and the API build validate compile-time and route integration. No real database, deployment, webhook delivery, or production data was exercised.
