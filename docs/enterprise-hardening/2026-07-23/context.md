# Hardening analysis context

## Source identity

- Local source root: `C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion`
- Base revision: `ec7e7e79f0ffd4872f1e2e8ecda110bc34e8efd0`
- Evidence snapshot date: `2026-07-23`
- Source drift: `present`
- Evidence collection SHA-256: `7eff422ec1998f593946ce3f205b2d6947a3135b5eeede2e453105c4f3cd40b3`
- Evidence artifact count: `20`

This is a source-derived hardening analysis, not a sealed Codex Security scan. The base revision was clean before the sprint; the evidence snapshot intentionally includes the active, uncommitted working-tree remediation. None of that source drift proves deployment. Database migrations `0050` through `0053` were not applied by this review.

The collection digest is SHA-256 over a UTF-8, LF-terminated manifest. Each manifest line is `<lowercase file sha256><two spaces><repository-relative POSIX path>`, sorted by path using ordinal order. This makes the analysis reproducible without putting the local source root into distributable artifacts. Migration `0054` and the durable executor store are included in this refreshed snapshot.

## Evidence registry

| ID | Reader-facing title | Source basis | What it establishes |
| --- | --- | --- | --- |
| `E001` | Admin user ownership and email collision | IAM mutation helper, delegation policy, and base-to-sprint diff | Identity creation must be create-only, and tenant ownership plus mutation must be atomic to prevent cross-tenant takeover. |
| `E002` | Session entitlement drift | Auth and IAM resolvers | Privileged use must revalidate current account status, membership, role, and permissions and revoke affected sessions on sensitive mutation. |
| `E003` | Dashboard ambient root credential | Dashboard BFF, central scope policy, and page regression | Feature pages could bypass the scoped BFF; only super-admin may remain global, while every other role must be session-tenant-bound. |
| `E004` | Repeated route-level tenant fixes | Resource and proof isolation regressions | The same forced-scope property recurs across domains, supporting an owned authorization boundary rather than permanent route-by-route interpretation. |
| `E005` | Legacy IOTA writer and public-proof trust | V2 writer, reconciler, executor, migration, and runtime regression | New evidence publication needs deterministic `proofId`, persisted `memoHash`, durable attempts, isolated signing, broadcast persistence, and independent chain verification. |
| `E006` | Tenant webhook unrestricted egress | SDK outbox, destination policy, worker, and migration | Tenant URLs require durable delivery plus DNS-complete public-address validation, TLS address pinning, redirect denial, response bounds, retry, and DLQ ownership. |
| `E007` | Best-effort audit insert | Audit helper | The current helper swallows database failure, allowing a privileged mutation to succeed without durable audit evidence. |
| `E008` | External-effect persistence already exists | Anchor attempts, webhook deliveries, audit tables, and migrations | The platform can migrate incrementally from feature-local state machines toward a shared outbox rather than rewrite every integration. |

## Integrity manifest

```text
ba8c89782701dfd2a169cf4b53c87790653cf2f3de46d6a33d89475f508ab8dc  apps/api/db/migrations/20260723193500_0051_iota_evidence_anchor_v2_writer.sql
2432e973bbd71e92a53cf4c341845a5d15c38cf0d06ebdeb5d09c561591b1b81  apps/api/db/migrations/20260723194500_0052_webhook_delivery_outbox.sql
fb37a270318f983cab4bed23c87072876ae7cd5b4302a1c905a84f9baec2a8be  apps/api/db/migrations/20260723213000_0054_iota_executor_publications.sql
5b344adc1f3e26bcba529491fba9a0b08c03407bb7697fa4597f64a6e177ce30  apps/api/src/app/internal/webhooks/worker/route.ts
0bc200757fe50c59ea47068a80961d2b20a3f4b38df89a466f229de28c7f1249  apps/api/src/lib/admin-user-management.ts
0cfecbec1ec15baf59aa64de9cea533495352c956f50cd79d3fffa7af8cdbeaa  apps/api/src/lib/admin-user-management-policy.ts
a6521211c5c4fb531682d56ca88e575188df763ae924a0382a02db3fdfa10dd5  apps/api/src/lib/audit-logger.ts
5441fdb586a14d42fe2948a06951c126bc2c19445fa06821301c42a5dd0a07b9  apps/api/src/lib/auth.ts
8283cfe79e495eba0ae3e4e70a0c400393852f8c6f8ef8c6d20287cdad568ef0  apps/api/src/lib/iam.ts
8ab9eb056a0cb5e6d1673610ca5423b55083181c16d20b915aca7b2def167328  apps/api/src/lib/iota-evidence-reconciler.ts
0bdc65fa0b374e91460788758f8294f27e767db963b8f06f330ba9824bc3ea45  apps/api/src/lib/iota-evidence-writer.ts
15bbf7d4dfc288820b8d2377a4609ffb86a28d7adcc2b89503f1472ccb01c653  apps/api/src/lib/sdk-webhooks.ts
e357e1635840755d8c67b1b5369767a460169db56915853730ea7ce7528b41ed  apps/api/src/lib/webhook-egress.ts
9bc60c30a8ae3a6b80dbab05376d859c17fc5afe48d37bbbc1f6b17beaa3077f  apps/api/tests/admin-resource-tenant-isolation.test.mjs
d48697614d4964e8a879ec9a15d9c61620f92f40047ead9bb59b7063618e7f57  apps/api/tests/iota-anchor-v2-runtime.test.mjs
a21ae592fe0f6b3080980a807c01935ac24943cb4ce46c2512d25649e1d0efbe  apps/dashboard/src/app/api/admin/[...path]/route.ts
cdb9e23fe5de787342dd5904b33e92cccd7928ed0a7e833225dc9708d183a1a6  apps/dashboard/src/lib/dashboard-tenant-scope-policy.ts
709377a35bb0675e6bbd4c7081d6e7af0f5234878f8fb7681920d0996e826d85  apps/dashboard/tests/tenant-scoped-page-reads.test.mjs
9a7d9121f0347744697dabfa9318be1cee1b629c7ac3b6406d46dc57fd291937  apps/executor/src/iota-idempotency.mjs
4a5ab6d8180df0afd8b74098d87e1b7e66e71ac2be86388b1d8676c3469badc3  apps/executor/src/server.mjs
```

## Validation evidence available at snapshot time

- IOTA proof suite: 30 passing tests.
- IOTA executor suite: 3 passing tests.
- IOTA contract harness: authorized publisher, unauthorized rejection, stored record, duplicate rejection, and revocation passed.
- IAM and login abuse suite: 17 passing tests.
- Focused tenant/IAM/SUN regression set: 35 passing tests in the sprint.
- Webhook security/outbox suite: 12 passing tests; SDK regression: 9 passing tests.
- Dashboard suite: 97 passing tests, TypeScript and production build passing.
- Production dependency audit: zero known vulnerabilities at the time tested.

These are command results, not production observations. PostgreSQL migration semantics, concurrent rate-limit behavior, executor crash recovery, proxy topology, and external egress still require staging validation against the deployed runtime.
