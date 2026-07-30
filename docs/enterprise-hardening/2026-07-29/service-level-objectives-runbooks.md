# nexID service-level objectives and operational runbooks

Status: implemented locally, not deployed, not wired to an alert manager.

This document defines the first measurable reliability contract for the nexID control plane. The authenticated endpoint is `GET /admin/observability/service-levels?window=24h`; the dashboard projection is `/service-levels`.

These are engineering objectives, not customer SLAs. A customer SLA needs an approved measurement period, exclusions, support hours, remedies and live runtime evidence. The current implementation derives aggregates from persisted PostgreSQL records, performs no writes and excludes demo/simulated records. It deliberately does not claim request availability for failures that happen before persistence.

## Truth and privacy boundary

- Source: PostgreSQL operational records already owned by each domain.
- Scope: a tenant administrator/reseller is forced to the tenant in the authenticated session. A superadmin may request one tenant or an authorized global aggregate.
- Permission: `analytics:read` in both the API and dashboard BFF.
- Response cardinality: fixed service and indicator identifiers only. Tenant IDs, tenant slugs, UIDs, event IDs, endpoint URLs, wallets, transaction hashes, payloads and error messages are not returned.
- Logging cardinality: route, selected bounded window, scope kind, duration, service availability count and alert-candidate count. Tenant and resource identifiers are not log dimensions.
- Query budget: the API uses the distributed `observability_read` policy, 12 requests per minute against a stable authenticated-user bucket, the contextual tenant/user/source bucket and one true tenant-wide bucket shared across users, sessions and source addresses. Raw bucket dimensions are HMACed by the existing durable limiter before persistence.
- Query coalescing: identical tenant/window snapshots share an in-flight computation and an instance-local cache for at most 10 seconds, bounded to 128 entries. This reduces duplicate work inside one process; it is not a distributed cache and does not replace the durable tenant-wide limit.
- EPCIS admission budget: capture starts at 2 requests per minute in one tenant-wide bucket shared across API keys and source addresses, in addition to principal/context buckets. This is an initial amplification guard, not a customer throughput entitlement. Higher commercial tiers require representative document-size, event-fan-out, latency and database-cost load evidence before the limit is raised.
- Demo policy: `source=demo`, `event_mode in (demo, simulated)`, simulated tokenization and `mock_test_only` IOTA anchors are excluded. Demo dashboard sessions get no fabricated SLO snapshot.
- Failure policy: a missing table, schema watermark or database produces `unavailable`; zero eligible traffic produces `no_data`; a clean sample below its minimum produces `insufficient_data`. None is represented as healthy.

## SLI catalog

| Service | SLI and formula | Persisted source | Initial objective | Minimum healthy sample | Important limitation |
| --- | --- | --- | ---: | ---: | --- |
| SUN | Complete persisted adjudications / eligible real tap events | `events` with `TAP_VALID`, `TAP_INVALID`, `REPLAY_SUSPECT` | 99.95% | 20 | Measures persistence completeness, not requests rejected or failed before a row exists. Invalid/replay is a valid adjudication and is not a platform failure. |
| Canonical event/outbox | Valid live operations / operations plus observed orphan canonical deliveries | `canonical_event_operations`, partitioned `events`, `webhook_deliveries` | 99.99% | 1 | Validates persisted identities plus envelope `schemaVersion`, id, type and canonical event reference. Historical endpoint subscription intent is not reconstructed after endpoint configuration changes. |
| Webhooks | `delivered / (delivered + dead_letter)` | `webhook_deliveries`, tenant owner from `webhook_endpoints` | 99.0% | 20 | Pending work is not a terminal failure and is evaluated by separate backlog signals. |
| Incidents acknowledgement | Eligible incidents with first progress in 15 minutes / incidents at least 15 minutes old | `event_incidents`, `event_incident_history`, source `events` | 95.0% | 5 | A transition proves recorded operator action, not the quality of investigation. |
| Incidents disposition | Eligible incidents resolved/dismissed in 4 hours / incidents at least 4 hours old | `event_incidents` | 90.0% | 5 | Dismissal is an audited disposition, not proof of remediation. |
| Polygon | `anchored / (anchored + failed)` for real Polygon requests | `tokenization_requests` | 99.0% | 5 | A request counts successful only after the existing engine has verified chain evidence; simulations are excluded. |
| IOTA | `confirmed / (confirmed + failed)` for real IOTA anchors | `evidence_anchors` | 99.0% | 5 | Mock anchors are excluded. Pending/submitted/reconciling are evaluated as queue state rather than terminal failure. |

The selected windows are server-bounded to `1h`, `24h`, `7d` and `30d`. Arbitrary SQL intervals are not accepted.

## Error-budget and alert contract

For objective `S` and measured good ratio `G`:

```text
error budget fraction = 1 - S
observed bad fraction = 1 - G
burn rate = observed bad fraction / error budget fraction
```

The endpoint returns candidates for the selected window. It does not claim a page or ticket was delivered. The production alert manager must evaluate both windows before notification:

| Severity | Fast window | Slow window | Required conjunction | Delivery contract |
| --- | ---: | ---: | --- | --- |
| Page | 1h burn >= 14.4x | 24h burn >= 6x | Same SLI breaches both | Primary on-call, acknowledge in 5 minutes, start incident record |
| Ticket | 24h burn >= 3x | 7d burn >= 1x | Same SLI breaches both | Reliability queue, assign owner in one business day |

Snapshot state is window-specific: `1h` can emit `page` at 14.4x; `24h` can emit `page` at 6x or `ticket` at 3x; `7d` can emit `ticket` at 1x; `30d` reports an objective `breach` at 1x without pretending that a page or ticket was delivered. A burn rate at or above 1x in a window without a notification threshold is likewise `breach`, not `healthy`.

An integrity violation can create a candidate even below the minimum healthy sample. Minimum sample suppresses false healthy status; it never hides observed failures.

Current-state signals do not wait for a terminal SLI. They describe the complete current queue/open set and are deliberately independent of the selected historical SLI window, so an unresolved item older than 30 days remains visible:

| Signal | Ticket | Page |
| --- | ---: | ---: |
| Oldest open webhook delivery | 5 minutes | 15 minutes |
| Overdue webhook deliveries | 1 | 25 |
| Oldest pending Polygon request | 15 minutes | 60 minutes |
| Overdue Polygon requests | 1 | 10 |
| Oldest pending IOTA anchor | 15 minutes | 60 minutes |
| Overdue IOTA anchors | 1 | 10 |
| Open high/critical incidents | 1 | 3 |
| Oldest open incident | 60 minutes | 4 hours |

## Runbook: SUN adjudication

1. Confirm the production schema watermark and the structured `/sun` error category. Do not paste a raw SUN URL into chat or a ticket.
2. Determine whether the request reached `nexid_persist_sun_scan_v1`. The SLI cannot observe a request that failed before persistence.
3. If a row exists, validate the atomic return and persisted event identity; distinguish a correct cryptographic rejection (`TAP_INVALID`, replay, inactive tag) from a platform failure.
4. Never modify KFile/KMeta, weaken CMAC validation, disable counter checks or replay the factory secret to diagnose availability.
5. If persisted and returned states diverge, open a critical incident, preserve the event partition identity and suspend mutating remediation until the transaction path is understood.

## Runbook: canonical event and outbox

1. Stop manual retries that do not reuse the original idempotency/operation key.
2. Inspect the canonical operation and its `(event_id, event_created_at)` identity. Preserve append-only records.
3. Validate any `evt_canonical_*` delivery against the operation tenant, event name, envelope `schemaVersion` and payload `canonicalEventId` using privileged tooling; never copy the payload to a general ticket.
4. An orphan or mismatch is a platform integrity incident. Do not repair it with direct SQL updates.
5. Reconcile through an approved forward-only operation and attach only opaque references to the incident.

## Runbook: signed webhook delivery

1. Check queue depth, overdue count and oldest age, then endpoint lifecycle (`active`, `disabled`, `deleted`) and sanitized failure class.
2. Confirm the delivery is durably retryable. Never blindly duplicate a delivery in an ambiguous state.
3. Check signing timestamp/version and whether a planned dual-secret overlap is active. Do not expose either secret.
4. If the consumer rejects valid signatures, coordinate clock skew and raw-body verification with the customer.
5. Rotate only through the audited lifecycle. Keep the old secret for the bounded overlap and revoke it after customer confirmation.

## Runbook: incidents

1. Assign an owner and transition `open -> investigating`; the durable history timestamp is the acknowledgement evidence.
2. For high/critical incidents, contain first. Record an explicit reason and keep the linked ticket synchronized.
3. Share only opaque references. Exclude full UIDs, emails, NFC keys, webhook payloads, signed URLs and wallet secrets.
4. Resolve or dismiss with evidence. Dismissal must state why it is not an incident; it is not counted as technical remediation.
5. If the 4-hour disposition objective is threatened, escalate to the tenant owner and platform/security owner.

## Runbook: Polygon ownership queue

1. Confirm real mode, configured executor, network/chain, contract readiness, gas and nonce ownership.
2. A transaction hash alone is not success. Require the existing receipt, contract event, token lookup and metadata validation.
3. Do not issue a second mint while the first send is ambiguous. Reconcile by idempotency key, transaction hash and on-chain state.
4. Keep signer material outside logs, response payloads and tickets. The SLO endpoint exposes only aggregates.
5. Resume only after the request has a deterministic terminal state or an audited recovery operation.

## Runbook: IOTA evidence queue

1. Inspect the durable anchor state (`pending`, `submitted`, `reconciling`) and executor lease before attempting recovery.
2. Reconcile by `proof_id`, transaction and receipt. Confirm expected chain, contract and authorized publisher.
3. Do not republish an ambiguous transaction and do not reveal private memo content; public evidence remains hash-only.
4. A confirmed status requires the existing on-chain verification path. A mock/test reference is never counted.
5. Resume retry only after lease expiry/reconciliation proves another send cannot create a duplicate effect.

## Rollout and evidence still required

1. Apply the required forward migrations through the repository's current watermark in an approved change window. Until then, missing sources remain `unavailable`.
2. Exercise the API as tenant A, tenant B and superadmin; prove tenant A cannot influence or observe tenant B aggregates.
3. Capture `EXPLAIN (ANALYZE, BUFFERS)` on production-like cardinality without saving customer values. Add indexes only through a reviewed forward migration.
4. Provision a least-privilege non-human identity for the scheduler, then configure it to request the four bounded windows and connect an alert manager to enforce the two-window conjunction. The current endpoint accepts authenticated admin sessions; do not reuse a person's long-lived credential. Prove notification delivery and acknowledgement before labeling paging automated.
5. Add request-level telemetry for `/sun` and worker invocations to close the documented pre-persistence blind spot. Use fixed operation/status dimensions; never use tenant, UID, endpoint, wallet, tx hash or error text as metric labels.
6. Run a controlled game day for SUN persistence, outbox mismatch, webhook backlog, incident escalation and ambiguous Polygon/IOTA sends.
7. Before high-cardinality production scale, benchmark the six aggregate queries with `EXPLAIN (ANALYZE, BUFFERS)` and representative tenant/global cardinality. The current 10-second, 128-entry instance-local cache is only a bounded first defense; move evaluation to distributed cached/materialized rollups if the p95 snapshot cost exceeds the operational budget. The dashboard must not poll the raw aggregates faster than the distributed limit.
8. Load-test EPCIS capture with representative document sizes and event/identifier fan-out. Keep the initial 2 requests/minute tenant-wide limit until measured database, queue and latency budgets support explicit higher tiers; document those tiers before exposing them commercially.

No production database mutation, deployment, external send or chain transaction was performed while implementing this contract.
