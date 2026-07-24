# Security Hardening Proposal: Centralize tenant authority

## Decision

We need to decide where nexID owns the invariant that only a super-admin may operate globally and every other administrative principal is bound to one current tenant, role and permission set. The current sprint closes concrete bypasses, but the design decision is whether those guards remain distributed or become a single typed boundary used by dashboard, API and repositories.

## Executive Recommendation

The complete option set is: **Option 1, strengthened local guards**; **Option 2, one owned tenant-authority boundary**; and **Option 3, external policy decision service**. I recommend Option 2 under the current monorepo and latency constraints. Option 1 is required as tactical protection during migration, while Option 3 becomes attractive only when nexID has several independently deployed services or policy authors outside the application team.

## Evidence

I inspected the base revision, current working changes, dashboard proxy and the focused isolation tests. The strongest signal is not one missing `WHERE tenant_id`; it is that an ambient root credential, session snapshots and route-local role assumptions could all independently create global authority.

| Evidence | Finding or document | What it establishes |
| --- | --- | --- |
| `E001` | Admin user ownership and email collision | Base IAM paths could update an existing email or target a user ID without proving exclusive tenant ownership; current tactical changes introduce create-only and ownership checks in `apps/api/src/app/admin/users` and `apps/api/src/lib/admin-user-management.ts`. |
| `E002` | Session entitlement drift | The base session model trusted role, membership and permission snapshots longer than the underlying IAM state; `apps/api/src/lib/auth.ts` is the enforcement boundary being corrected. |
| `E003` | Dashboard ambient root credential | Several server pages used `ADMIN_API_KEY` directly and treated only `tenant-admin` as tenant-scoped, while `viewer` and `reseller` could fall into a global branch; the proxy in `apps/dashboard/src/app/api/admin/[...path]/route.ts` already has a better scoped-principal path. |
| `E004` | Repeated route-level tenant fixes | Focused tests in `apps/api/tests/admin-resource-tenant-isolation.test.mjs` and `apps/api/tests/admin-proof-tenant-isolation.test.mjs` show the same forced-scope property recurring across resources. |

**Observed:** authority is represented in several forms: bearer root key, dashboard session, `x-nexid-admin-scope`, tenant slug, permission list and resource IDs. Different routes historically resolved them in different orders.

**Inferred:** the recurrence is structural because callers can reach SQL or the root API before one component has converted those forms into a final scoped principal. A new page or route can reproduce the class without modifying the existing guards.

## Current Design And Failure Mode

The dashboard has a capable BFF that translates a session into scoped headers, but server pages can bypass it and call the API with the ambient root key. The API then has a mixture of central helpers and local SQL conditions. IAM mutations are especially sensitive because email collision, role assignment, password reset, MFA reset and session revocation affect global identities even when a membership is tenant-local.

The failure mode is confused authority: a caller authenticates successfully, but global capability survives longer than the tenant decision. Filtering a response after a global query is not containment because the process already received cross-tenant data. Likewise, checking ownership before a separate mutation leaves a race window unless the database owns both the lock and mutation.

## Desired Invariants

- Only a current `super-admin` may request or receive a global administrative scope.
- Every other real dashboard role is bound to one non-empty current tenant before any upstream call.
- Permission, `admin_status` and membership are revalidated from current IAM state for every privileged session use.
- The final resource identity and tenant ownership are resolved before authorization and remain inside the same transaction for mutations.
- Root service credentials never flow through feature pages and cannot substitute for a scoped principal.
- Repository APIs make an unscoped tenant read or mutation difficult to express accidentally.
- Demo access is an explicit sandbox principal, never a fallback to production authority.

## Constraints And Non-Goals

The near-term design must preserve the Next.js App Router, current PostgreSQL schema, dashboard latency and existing super-admin global workflows. No measured authorization latency budget was supplied, so we assume one current-IAM lookup per request is acceptable and must be measured. This proposal does not design customer-facing ABAC, row-level encryption or physical database-per-tenant isolation.

## Before Architecture

The before view shows the key problem: the scoped BFF and direct root-key path coexist at the same abstraction level.

[Before architecture](../diagrams/centralize-tenant-authority-before.mmd)

## Options

### Option 1: Strengthened local guards

This option keeps existing pages, routes and SQL ownership patterns, then patches each known path. Its strongest case is delivery speed: the sprint can block the demonstrated takeover and disclosure paths without introducing a new framework. Current create-only IAM CTEs, forced tenant resolution and regression tests are examples of the right tactical work.

The residual concern is recurrence. Each new page must remember not to use `ADMIN_API_KEY`; each route must choose the correct helper; each mutation must combine ownership and update atomically. Review and static tests reduce that risk but do not change who owns the invariant. Rollback is easy because changes remain local, yet that same locality makes control drift likely.

[Option 1 architecture](../diagrams/centralize-tenant-authority-local-guards-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Dashboard scope | Role-specific branches | Every known non-super branch forces tenant | Demonstrated global disclosure paths close | Repeated page edits and tests |
| IAM mutation | Separate or permissive ownership logic | Atomic create-only/ownership guards | Demonstrated account takeover and cross-tenant mutation close | More route-local SQL complexity |
| Session use | Snapshot trusted | Current membership/status checked | Revoked authority expires promptly | Additional database reads |

### Option 2: One owned tenant-authority boundary

This option makes the scoped principal a first-class server type produced once from the current session and IAM state. Dashboard feature pages may reach admin data only through the BFF. API application services receive a `GlobalPrincipal` available only to super-admin or a `TenantPrincipal` carrying tenant ID, tenant slug, current role and evaluated permissions. Tenant repositories require the latter in their signatures and add tenant predicates internally.

The attractive property is compositional safety: a caller cannot forget a query parameter because it never receives an unscoped repository. Global operations stay explicit and auditable. The extra work is migration rather than runtime infrastructure: direct SQL callers must move behind repositories or typed query helpers, and the policy boundary needs contract tests. We should expect a small IAM lookup cost and measure p50/p95/p99 authorization latency under realistic concurrency. A short-lived cache may be added only with versioned entitlements and immediate invalidation on IAM mutation.

Rollback can preserve the new BFF-only rule while temporarily routing a repository method to existing SQL. That makes migration reversible without restoring the ambient root path.

[Option 2 architecture](../diagrams/centralize-tenant-authority-owned-boundary-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Policy ownership | Pages and routes interpret authority | One resolver emits a typed final principal | Authority cannot silently widen between layers | Shared library and caller migration |
| Data access | SQL may accept missing tenant | Tenant repository requires tenant principal | Unscoped access becomes an explicit exceptional API | Repository surface and contract tests |
| Root credential | Available to server pages | Confined to BFF/upstream transport | Feature code cannot impersonate global admin | BFF becomes a critical dependency |

### Option 3: External policy decision service

A dedicated policy engine can evaluate subject, tenant, resource and action, while local policy enforcement points apply the decision and obligations. Its strongest case is organizational scale: policies can be reviewed centrally, versioned independently and shared by several languages or services. It also creates a clean place for customer-specific ABAC and decision logs.

What gives me pause now is failure complexity. A network hop enters every privileged request, policy/resource drift can produce surprising decisions, and the application still must enforce tenant predicates locally. A policy service does not remove the need for Option 2's typed enforcement boundary; it replaces only the decision implementation. We would also need fail-closed behavior, local emergency policy, cache/version semantics and an outage SLO.

I would choose this option when nexID has at least two independently deployed control planes with demonstrably duplicated policy or when enterprise customers require delegated policy administration. Until then it adds more trusted infrastructure than the evidence justifies.

[Option 3 architecture](../diagrams/centralize-tenant-authority-policy-service-after.mmd)

| Change | Before | After | Security consequence | Cost |
| --- | --- | --- | --- | --- |
| Decision point | In-process helpers | Versioned external PDP | Cross-service policy can converge | New highly available service |
| Enforcement | Route-local | Local PEP applies returned obligations | Decisions remain tied to final resource | Correctness split across PDP and PEP |
| Operations | Application-only deploy | Policy and application deploys | Independent review/audit possible | Drift, cache and outage runbooks |

## Comparison

No composite score is useful here; the decisive question is whether recurrence risk justifies a new owned boundary.

| Dimension | Option 1: local guards | Option 2: owned boundary | Option 3: policy service |
| --- | --- | --- | --- |
| Security | Closes known paths; future callers can drift | Makes tenant/global distinction explicit and reusable | Adds centralized decisions but still needs Option 2-style enforcement |
| Performance | No new hop; current-IAM checks add DB work | In-process policy plus repository scoping; measurable DB lookup | Network hop/cache on privileged path |
| Memory | Neutral, bounded helper state | Small typed principal/cache footprint | Service process, policy bundles and caches |
| Reliability | Few new dependencies; inconsistent failure modes remain | BFF/policy helper becomes owned critical path | PDP outage and version drift become new failure modes |
| Operability | Many static tests and route reviews | Central decision logs, metrics and fewer enforcement sites | Separate deploy, SLO, policy promotion and incident handling |
| Migration | Lowest initial cost, repeated forever | Medium one-time caller/repository migration | Highest; policy model and dual-run required |

These effects are source-derived or hypothetical, not measured. The validation plan below supplies the workloads and gates needed before we call the performance/reliability trade acceptable.

## Recommendation

I recommend Option 2, with Option 1 kept as tactical containment while callers migrate. It fits the monorepo, reuses the existing BFF and current auth helpers, and removes ambient authority without a new service. Option 3 should win if policy must span independently released runtimes or customer-managed ABAC; it should not be introduced merely to make the architecture look enterprise.

The current sprint appears to implement important pieces of Options 1 and 2, but this proposal is not proof of deployment or complete coverage. The acceptance work must still demonstrate that no feature page uses the root key and no tenant repository exposes an unscoped call to a non-super principal.

## Evidence Coverage And Residual Risk

| Evidence | Option 1 | Option 2 | Option 3 | Tactical fix still required |
| --- | --- | --- | --- | --- |
| `E001` — Admin user ownership and email collision | Addresses known IAM paths | Addresses and reduces recurrence through owned resource resolution | Mitigates decision drift; atomic DB mutation still local | Yes, keep create-only and row-lock CTEs |
| `E002` — Session entitlement drift | Addresses with revalidation | Addresses through final principal construction | Addresses if PDP input is current; session invalidation still required | Yes |
| `E003` — Dashboard ambient root credential | Addresses known pages | Addresses structurally by BFF-only data access | Mitigates only if transport is also constrained | Yes, remove direct calls now |
| `E004` — Repeated route-level tenant fixes | Mitigates | Addresses the repeated control owner | Mitigates; PEP correctness remains | Yes during migration |

Residual risk includes SQL executed outside the repository boundary, background jobs without an end-user session, super-admin abuse and database operator access. Those require service principals, least privilege, immutable audit and separation of duties; none are solved by a role helper alone.

## Migration And Rollout

- Preserve all current tactical IAM, SUN and resource-scope tests.
- Introduce the typed principal resolver and fail closed for non-super sessions without a tenant.
- Route every dashboard admin read through the BFF; add a static gate that rejects `ADMIN_API_KEY` under feature pages.
- Move highest-risk repositories first: users, credentials, proof anchors, batches, tags, loyalty and CRM PII.
- Dual-log legacy versus central policy decisions without granting on disagreement; alert on any mismatch.
- Canary one internal tenant, then tenant-admin/viewer/reseller cohorts, then super-admin global operations.
- Roll back individual repository migrations, not the BFF-only/root-key containment.

## Validation Plan

- Run a role-by-resource matrix for super-admin, tenant-admin, reseller, viewer, suspended user, removed membership and demo principal.
- Attempt query, path, body and header tenant overrides against every admin route.
- Race ownership checks against role/reset/MFA mutations and prove the losing transaction cannot mutate.
- Generate two tenants with colliding resource shapes and assert no row/count/timing-derived data crosses the boundary.
- Benchmark 1, 10 and 100 concurrent privileged requests, comparing current-IAM lookup p50/p95/p99 and database connection use to the base revision. Set the release threshold after collecting the baseline; no percentage is invented here.
- Kill the IAM database/cache dependency and verify fail-closed responses, bounded timeout and usable super-admin break-glass runbook.

## Implementation Work Packages

- Dashboard BFF-only server client and central effective-scope helper.
- API typed principal and current-entitlement resolver.
- Tenant-scoped repository/query interfaces and explicit super-admin global interfaces.
- Atomic resource ownership/mutation primitives.
- Decision/audit telemetry with actor, tenant, resource, action, policy version and outcome.
- Static dependency rule plus integration/property tests.

## Open Questions

- Are reseller and viewer always attached to exactly one tenant, or do we need a separate reseller organization with an explicit tenant allowlist?
- Which background jobs legitimately span tenants, and what service-principal approval model applies?
- What maximum permission-revocation propagation time will enterprise contracts promise?
- Does break-glass require dual approval before the first global read or only before mutation?
