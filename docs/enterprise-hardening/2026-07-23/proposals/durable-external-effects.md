# Security Hardening Proposal: Make privileged external effects durable and capability-scoped

## Decision

nexID publishes blockchain evidence, sends tenant webhooks and records privileged audit events. We need to decide whether each feature continues to invent its own reliability/security envelope or whether every external side effect follows one durable-intent, leased-attempt and independently verified state machine.

## Executive Recommendation

The options are **Option 1, hardened feature-local state machines**; **Option 2, shared transactional outbox and capability adapters**; and **Option 3, isolated publication, egress and audit services**. I recommend completing Option 1 as immediate containment and adopting Option 2 as the next structural step. Option 3 is the mainnet/regulated target for high-value key custody and restricted egress, but it should follow measured workload and operational ownership rather than precede them.

## Evidence

I inspected the chain writer/verifier, executor, webhook dispatcher and audit logger. The IOTA V2 work is especially useful evidence because it demonstrates the desired sequence: deterministic identity, database reservation, broadcast identity persistence and independent reconciliation. The webhook and audit paths show why that sequence should become reusable rather than remain blockchain-specific.

| Evidence | Finding or document | What it establishes |
| --- | --- | --- |
| `E005` | Legacy IOTA writer and public-proof trust | The base writer used a legacy contract adapter and synchronous signing assumptions; public verification could over-trust mutable database state. Current V2 work in `apps/api/src/lib/iota-evidence-writer.ts`, `apps/api/src/lib/iota-evidence-reconciler.ts` and `apps/executor/src/server.mjs` establishes a stronger pattern. |
| `E006` | Tenant webhook unrestricted egress | `apps/api/src/lib/sdk-webhooks.ts` accepts stored tenant URLs and performs outbound fetches; without DNS/IP/redirect controls, timeout and durable retry ownership, this is an SSRF and reliability choke point. |
| `E007` | Best-effort audit insert | `apps/api/src/lib/audit-logger.ts` catches database errors and logs a warning, so a privileged action can succeed without durable audit evidence. |
| `E008` | External effect persistence schema | `evidence_anchor_attempts`, `webhook_deliveries` and `audit_logs` already provide domain-specific persistence that can support staged migration rather than a rewrite. |

**Observed:** the three features cross different trust boundaries but share the same dangerous transition: application state says “do this” and a process with ambient network, signing or audit authority performs an effect that may outlive the request.

**Inferred:** retries, idempotency, capability isolation and evidence verification are a common control family. If each caller owns them, crash windows and fail-open behavior will recur with email, ERP exports and future EU Registry publication.

## Current Design And Failure Mode

In the base shape, an API request can call a chain adapter, fetch a tenant endpoint or insert an audit row inline. A timeout does not reveal whether the external system accepted the effect. Retrying can duplicate it. Tenant-controlled URLs extend application network authority to internal addresses. A signer in the web process turns input validation bugs into key-use authority. A swallowed audit failure separates the business mutation from its accountability record.

IOTA V2 materially improves one branch: the proof has a deterministic `proofId`; the database stores anchor and attempts before the network; the executor validates chain, contract and publisher; the API stores `tx_hash` after broadcast; a worker validates receipt, calldata, event, storage and confirmations. That does not automatically fix webhook or audit semantics, and the current executor still needs KMS/HSM for enterprise key custody.

## Desired Invariants

- A privileged external effect has a deterministic identity or idempotency key before execution.
- Durable intent is committed before any broadcast, fetch or irreversible mutation.
- A crash after external acceptance but before local acknowledgement can be reconciled without blindly duplicating the effect.
- Workers lease attempts atomically, apply bounded retry/backoff and preserve a terminal/DLQ state.
- Tenant-controlled destinations can reach only validated public HTTPS endpoints; private, loopback, link-local, multicast and metadata networks remain unreachable after DNS resolution and redirect handling.
- Chain signing, unrestricted egress and immutable audit sinks are separate capabilities, not ambient authority of feature code.
- Confirmation means independent evidence: chain receipt/calldata/event/storage, webhook response under policy, or acknowledged immutable audit sink.
- Critical business mutations declare whether audit failure blocks the mutation; this policy is tested rather than implied.

## Constraints And Non-Goals

The design must keep SUN/passport reads available when IOTA is unavailable and must not turn webhook latency into SDK request latency. PostgreSQL is the existing durable coordination store. No measured throughput, chain publish rate or webhook fanout budget was supplied. This proposal does not choose a cloud KMS vendor, message broker or SIEM product and does not claim that blockchain confirmation supplies legal non-repudiation.

## Before Architecture

The before view highlights three feature-local effects with different and incomplete failure semantics.

[Before architecture](../diagrams/durable-external-effects-before.mmd)

## Options

### Option 1: Hardened feature-local state machines

Each domain keeps its own table, worker and state machine. IOTA uses anchors/attempts, webhooks use deliveries, and audit classifies critical versus best-effort events. This is the fastest complete containment because the schemas and owners already exist. It also permits domain-specific confirmation: a chain receipt is not modeled as an HTTP delivery.

The security gain depends on consistent primitives. Webhook URL validation must resolve all A/AAAA results, block prohibited ranges, reject redirects or revalidate every hop, and bound connect/read/response size. IOTA must never publish from the web runtime in production. Critical audit records must share a transaction with the business mutation or enter an outbox in that transaction.

The drawback is duplicated leasing, retry, error sanitization and metrics. Drift remains possible, but the immediate exposure closes without a platform migration. Rollback can disable a worker and leave intents queued; it must never delete attempts or mark them successful.

[Option 1 architecture](../diagrams/durable-external-effects-local-state-machines-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Chain publication | Inline/legacy writer assumptions | V2 durable attempts plus isolated executor/reconciler | Duplicate and mutable-proof trust paths narrow | Worker, executor and reconciliation operations |
| Webhook delivery | Tenant URL fetched inline | Validated destination plus persisted delivery/retry | SSRF and crash-window risk narrow | DNS/egress logic and worker |
| Audit | Failure swallowed | Critical policy is transactional or durable | Privileged mutation cannot silently lose required evidence | Some actions may fail when audit storage is down |

### Option 2: Shared transactional outbox and capability adapters

This option standardizes the common lifecycle while leaving confirmation logic in adapters. The domain transaction writes business state and an outbox record containing effect type, tenant, idempotency identity, payload digest, policy version and not-before time. A leased dispatcher routes it to capability-specific adapters. Adapters store attempts and evidence, then mark the outbox complete only after their own verification rule succeeds.

The strongest case is reliability and reviewability. Every future external effect inherits one crash model, lease protocol, retry budget, DLQ, metrics and replay tooling. The application can answer quickly with a durable operation ID. Backpressure becomes visible in one place instead of hiding in request latency.

What we pay is coordination load in PostgreSQL and a more critical dispatcher. Large payloads must stay outside the outbox or be bounded/content-addressed. Fair scheduling prevents one noisy tenant or degraded provider from starving others. The database query should use `FOR UPDATE SKIP LOCKED`, tenant/provider concurrency caps and retention partitions. We need measurements for queue depth, lease contention, write amplification and p99 time-to-effect.

Rollback is practical: adapters can continue reading their domain tables while dual-write is disabled. Completed outbox records remain evidence and must not be recreated.

[Option 2 architecture](../diagrams/durable-external-effects-shared-outbox-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Intent ownership | Feature request stack | Domain transaction plus shared outbox | No effect exists without durable, attributable intent | Extra write/index per effect |
| Retry/lease | Per feature | Shared dispatcher with adapter verification | Consistent idempotency and DLQ policy | Dispatcher capacity/fairness engineering |
| Capability use | Feature code reaches sink | Adapter receives minimum capability | Network/signing/audit authority narrows | Adapter API and policy versioning |

### Option 3: Isolated publication, egress and audit services

Separate services consume an authenticated durable queue. The chain service alone can invoke KMS/HSM; the egress service runs with restrictive network policy and DNS-aware proxying; the audit service writes WORM storage/SIEM. Compromise of the application API no longer grants all three capabilities.

This is the strongest containment option and the likely destination for regulated mainnet operations. It also creates independent scaling and change control. The price is genuine distributed-systems work: queue availability, service identity, replay protection, schema compatibility, multi-region ordering, observability and incident ownership. A service boundary without restrictive IAM/network policy would add latency without adding security.

Option 3 becomes preferable when key custody must be non-exportable, tenants require dedicated egress/data residency, or audit evidence must survive database administrator compromise. It should be introduced capability by capability. IOTA executor isolation is already a useful first slice; it does not justify prematurely extracting every adapter.

[Option 3 architecture](../diagrams/durable-external-effects-isolated-services-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Runtime authority | API/worker has mixed capabilities | Each service has one sink capability | Compromise blast radius is materially reduced | Service IAM, deploys and on-call ownership |
| Key custody | Exportable pilot signer possible | KMS/HSM signs under policy | Key extraction path closes | Vendor integration and recovery ceremony |
| Audit survival | Same operational database | External WORM/SIEM evidence | DB operator cannot silently rewrite all evidence | Retention cost and privacy governance |

## Comparison

| Dimension | Option 1: local state machines | Option 2: shared outbox | Option 3: isolated services |
| --- | --- | --- | --- |
| Security | Closes current sink-specific paths; primitive drift remains | Consistent durable intent and least-capability adapters | Strongest process/network/key isolation |
| Performance | Removes external latency from requests but uses per-domain polling | One extra transactional write and shared lease contention | Queue/network hop for every effect |
| Memory | Bounded worker state | Bounded dispatcher buffers; payloads must remain small | Separate service processes and client buffers |
| Reliability | Domains fail independently; recovery tools differ | Uniform retry/DLQ; dispatcher/DB become critical | Better sink isolation, more distributed dependencies |
| Operability | Several workers/metrics | One queue control plane plus adapter dashboards | Multiple SLOs, identities, deploys and incident paths |
| Migration | Lowest; current schemas reused | Medium dual-write/backfill and adapter cutover | Highest; queue/service contracts and infra rollout |

All performance and resource statements are source-derived or hypothetical. We have unit/build evidence for specific code paths, not production load measurements.

## Recommendation

I recommend two deliberate horizons. Finish Option 1 now for every known privileged sink: V2 chain writer, SSRF-safe durable webhook delivery and explicit critical-audit policy. Then build Option 2 so EU Registry, ERP export and future notifications do not reimplement the same crash window. Adopt Option 3 first for IOTA/Polygon key custody, then egress and WORM audit when contracts justify their isolation.

Option 1 alone is acceptable for a bounded testnet pilot. It is not enough for a global enterprise claim because the signer mode, audit durability and egress enforcement still need deployment evidence. Option 3 should not win purely because “microservices” sounds mature; it wins when blast-radius or regulatory requirements outweigh operational cost.

## Evidence Coverage And Residual Risk

| Evidence | Option 1 | Option 2 | Option 3 | Tactical fix still required |
| --- | --- | --- | --- | --- |
| `E005` — Legacy IOTA writer and public-proof trust | Addresses with V2 writer/reconciler | Addresses and standardizes intent lifecycle | Addresses plus stronger signer isolation | Yes, preserve V2 exact verification |
| `E006` — Tenant webhook unrestricted egress | Addresses with URL/DNS/redirect policy and worker | Addresses and reduces retry/control drift | Addresses with network-isolated egress | Yes, SSRF validation cannot wait |
| `E007` — Best-effort audit insert | Mitigates with critical action policy | Addresses durable intent but external immutability optional | Addresses DB compromise with WORM sink | Yes for critical mutations |
| `E008` — Existing persistence schema | Reuses | Migrates into shared lifecycle | Feeds services through queue | No vulnerability; migration evidence |

Residual risks include malicious but public webhook endpoints, tenant data exfiltration through permitted payloads, chain reorg/finality policy, KMS policy abuse, queue operator access and sensitive data retained in audit/outbox payloads. Payload schemas, egress allowlists, confirmations, separation of duties and retention policy must address those separately.

## Migration And Rollout

- Keep IOTA new writes V2-only and historical V1 read-only.
- Deploy each local worker disabled, backfill/reconcile pending rows, then canary one tenant/provider.
- For webhooks, validate stored endpoints before enabling delivery; quarantine invalid/private resolutions and expose an actionable admin status.
- Classify privileged actions as transactional-audit-required or best-effort, with a security review for every best-effort exception.
- Introduce a shared outbox in shadow mode, dual-write digests and compare domain/outbox terminal states without double-sending.
- Cut adapters one at a time with tenant/provider concurrency caps and a kill switch that queues rather than discards intent.
- Introduce isolated services only after service identity, KMS/network policy, queue replay and disaster recovery are rehearsed.

## Validation Plan

- Inject crashes before broadcast, after broadcast, after response, before local acknowledgement and during confirmation; prove one logical effect and recoverable state.
- Send concurrent HTTP retries with the same idempotency key and verify a single chain tx/webhook logical delivery.
- Exercise IPv4/IPv6 loopback, RFC1918, link-local, multicast, IPv4-mapped IPv6, decimal/octal variants, metadata hosts, private DNS answers and redirect chains; no request may reach a prohibited address.
- Bound DNS, connect, header, body and total timeouts and response bytes; verify worker leases recover after termination.
- Simulate provider outage and noisy tenant load; measure queue age, attempts, DB connections, lease contention and fairness at 1x/10x expected pilot throughput.
- Reorg or replace a chain receipt in a test harness and verify confirmation returns to non-final/failed policy rather than trusting the database.
- Fail PostgreSQL and external audit sink during a critical IAM mutation; confirm behavior matches the declared fail policy and produces an incident signal.

## Implementation Work Packages

- Domain idempotency and durable-attempt schemas with retention/partition policy.
- IOTA executor KMS interface, nonce ownership and multi-instance coordination.
- Webhook destination policy, DNS-safe transport, response limits, retry worker and DLQ controls.
- Critical audit transaction/outbox policy and external sink adapter.
- Shared outbox lease/retry/fairness library and adapter contract.
- Unified metrics: queue age, attempt rate, terminal failure, duplicate prevention, reconciliation mismatch and tenant/provider saturation.
- Chaos, load, migration and recovery harnesses.

## Open Questions

- Which actions are contractually required to fail when durable audit evidence is unavailable?
- What confirmation depth and reorg response will each IOTA/Polygon environment promise?
- Will enterprise tenants supply webhook domain allowlists or require dedicated egress IPs/mTLS?
- Which KMS/HSM/custody provider supports the target chains, regions and recovery controls?
- What payload retention and redaction rules apply to the outbox, delivery attempts and WORM audit sink?
