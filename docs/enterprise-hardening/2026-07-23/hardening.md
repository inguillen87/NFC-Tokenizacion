# Security Hardening Review: nexID enterprise control plane

## Evidence Basis

This review is derived from source inspection of base revision `ec7e7e79f0ffd4872f1e2e8ecda110bc34e8efd0`, the active sprint diff and focused security regressions. It is not a sealed Codex Security scan and it does not prove that working-tree changes are deployed. The evidence registry, source drift and artifact hashes are recorded in [context.md](context.md).

The evidence supports two structural opportunities. First, global versus tenant authority has been interpreted by too many pages, routes and SQL callers. Second, blockchain publication, tenant webhooks and privileged audit share a durable external-effect problem that should not be solved independently each time.

## Constraints

We assume a balanced security/delivery profile, the existing Next.js/PostgreSQL monorepo, no supplied production latency or memory budget, and a staged path from testnet pilot to regulated enterprise operation. Current tactical fixes must remain in place while architecture migrates. No proposal treats a diagram as remediation or authorizes a production database migration/deploy.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Centralize tenant authority | IAM ownership/session drift, dashboard ambient root credential and repeated route scoping (`E001`–`E004`) | Local guards; owned typed boundary; external policy service | Use the owned boundary now; preserve local guards during migration | [Centralize tenant authority](proposals/centralize-tenant-authority.md) |
| Make privileged external effects durable and capability-scoped | IOTA legacy/public-proof boundary, webhook egress, best-effort audit and existing attempt tables (`E005`–`E008`) | Local state machines; shared outbox; isolated services | Finish local containment, then converge on shared outbox; isolate key/egress/audit capabilities by risk | [Durable external effects](proposals/durable-external-effects.md) |

## Recommendation Summary

I recommend an incremental structural path, not a rewrite. For tenant authority, the existing dashboard BFF and current-IAM resolver give us enough material to establish one typed policy/enforcement boundary without adding a network policy service. That is the smallest design that makes a future unscoped caller conspicuous.

For external effects, IOTA V2 demonstrates the right lifecycle and should remain the immediate model: reserve durable identity, isolate the capability, persist broadcast identity and verify independently. Webhooks and critical audit should reach the same safety level now. A shared transactional outbox then reduces recurrence across EU Registry, ERP exports and notifications. Full service extraction is justified first for non-exportable chain keys, network-restricted egress and WORM audit—not for every adapter by default.

The portfolio intentionally keeps two truths visible: the sprint closes concrete high-impact findings, and nexID still needs deployment evidence, KMS/HSM, durable audit, recovery drills and interoperability work before claiming global enterprise readiness.

## Next Decisions

- Confirm whether reseller principals are single-tenant or organization-scoped with an explicit tenant allowlist.
- Approve the owned tenant-principal/repository boundary as the target architecture after the current dashboard/API tactical patches land.
- Classify which privileged actions must fail closed when durable audit evidence is unavailable.
- Select the production custody/egress/audit operating model before mainnet or regulated customer data.
- Supply workload/SLO assumptions so authorization latency, outbox contention, queue age and recovery thresholds can be measured rather than guessed.
