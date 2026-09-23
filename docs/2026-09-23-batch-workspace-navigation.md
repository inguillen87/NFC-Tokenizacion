# Dashboard .36 — batch workspace continuity

Continuation base: `4ce16fdbb7d8dc9ad20701d35cbebbf09ae33c94`.
Previous application source: `183ff4173a545edd39e7afe3902f5e99bdfb6078` (.35).
Release: `2026.09.23-dashboard.36`.

## Plan outcome

Advance M-04 of the supplied September 17 audit: reuse the existing dossier and
operational screens so an operator can follow one batch without reconstructing
company context. This is navigation continuity, not a claim that all of M-04,
physical onboarding, quality acceptance or production publication is complete.

Source inspection found that the dossier's Passport Studio links omitted the
selected tenant. Its retry and batch-list links also omitted that context.
Other workspaces had individual return links but no common cross-workspace
navigation. These are source findings, not observed production incidents.

## Implemented

The dossier, passport, label-production, QR/NFC channels, traceability, movement
intake and recall pages now share one server-projected navigation block. It
shows the requested company, batch reference and current screen. Every available
link retains the exact encoded batch and canonical company. Returning to the
batch list retains the company. Existing dossier editor/retry links were fixed.

The projection reuses the existing batch destination, scope, intake and recall
policies. Explicit denies win; an unknown role, foreign company or malformed
context produces no link. The new navigation offers no live-operation links in demo mode.
A globally authorized session without a selected company is asked to select one
rather than silently generating global links. UI availability is not backend
write authorization; destination pages and APIs keep their existing guards.

Only seven named route destinations are constructible. URLs do not copy arbitrary
query parameters, cursors, credentials, return URLs or unreviewed paths. No
session object or permission list is serialized into navigation markup. No new
fetch, database access, polling, router mutation or business action is added.
Link prefetch is explicitly false. Selecting a destination still performs that
page's existing authorized reads; it does not approve a passport, publish labels,
change lifecycle, create a movement, or close a recall.

The block uses existing visual tokens with Spanish, English and Portuguese copy,
44px-or-larger link targets, visible focus and one current-page indication.
Routes are links, not fake tabs. On mobile the destinations form two columns.
The caption tells operators to save pending work before leaving a page. This
increment does not persist drafts across route navigation. Existing within-
dossier tabs retain their component instances and draft behavior.

## Validation and scope

The 27 new Node tests exercise route encoding, malformed input, selected-tenant
isolation, existing role/deny rules, demo restrictions, route wiring, localized
copy, and the actual component's Link props/current-page semantics. A read-only
fixture was corrected to use the existing `viewer` role rather than an invented
`analyst` role; the policy continued to reject the unknown role.

The new browser harness renders the actual navigation and policy modules with
synthetic sessions and destination bodies. Next Link is explicitly substituted
by a native anchor. It follows 144 deliberate route hops and checks 168 rendered
pages across three locales, two themes, four widths and seven destinations.
1,298 assertions passed, including scoped links, keyboard activation, denied/demo
states, no business requests, overflow and scoped automated axe checks. Mobile
light and desktop dark captures were manually inspected. This is not an
end-to-end test of each destination's business workflow or actual authentication.

The existing dashboard acceptance workflow gains one isolated browser command;
its dependency, typecheck, unit, build, secrets, support, CRM and Next-served map
gates are retained. There is no new runner, cache, artifact upload or service.
The final local dashboard suite passed: 1,159 total, 1,157 passed, zero failures or cancellations, two existing optional browser skips. Typecheck, production build, dependency audit and secret custody passed. The exact-commit CI and Vercel results must be recorded after execution.

API, Web, executor, package versions, SQL migrations, SUN/SDM, TTStatus, keys,
roles and production domains are not modified by this increment. The API .2 and
migration 0112 prerequisites remain separate publication gates. A candidate
READY result is not a promotion or authenticated production acceptance receipt.

Implementation references consulted: Next.js Link documentation (prefetch=false)
and W3C APG navigation/current-page guidance. Automated checks do not constitute
an accessibility certification or a manual screen-reader evaluation.

## Verified GitHub and Vercel result

Runtime source `940b15cbdc06d5baca25eb4867925ebb3ab23633` was pushed by normal
fast-forward to the existing dashboard continuation branch. GitHub Actions run
`35813808933`, job `107030918369`, passed on its first attempt, completed at
2026-09-23T03:23:05Z. Logs were read after completion. They confirm 1,157 passed,
zero failed/canceled and two existing optional skips in the 1,159-test suite,
typecheck/build, dependency audit and secret custody. Existing support 296/24,
CRM 1,021/36, new navigation 1,298/168 (144 route hops), and both map 29/4 runs
passed. One map run used worker assets served by a real Next production server.

The navigation browser tests use actual component/policy modules with synthetic
sessions and destination bodies, and a native-anchor substitute for Next Link.
These are navigation checks, not seven authenticated end-to-end business flows.
The local mobile/light and desktop/dark navigation captures were inspected.

Vercel candidate `dpl_96R5zEUVmJiaexg4pMgd87p34nhy` reached READY on the existing
Dashboard project with native Git SHA equal to the exact runtime above and
`autoAssignCustomDomains: false`. Authorized CLI HTTP reads returned the .36
release marker identical to the committed JSON and `/novedades` with the new
context-preserving navigation card. These are not tenant-business acceptance.

Final provider reads retained production API `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V`
and Dashboard `dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`. No promotion or SQL migration
was called. The migration ledger was not reread in this increment; its prior
0112 gate is retained, not silently considered satisfied. Existing .35 and API
.2 candidate records remain untouched. This documentation-only addendum and
new .36 evidence manifest do not change the validated application or cause a
new application build.
