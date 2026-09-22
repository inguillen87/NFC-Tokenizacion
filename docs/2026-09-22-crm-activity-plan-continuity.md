# CRM activity: plan review and bounded implementation

Base: `056b73eedcd2dce71db078f7ad0b1b8844022620`.
Continue on `codex/nexid-s9-ticket-deadline-20260922`; no new integration branch.

## Plan review

The supplied September 17 product audit and the DPP/enterprise goal prioritize
reliable operation, task-oriented post-TAP UX, passport governance, adoptable
integration, and incidents/recalls. They explicitly recommend preserving existing
CRM, SDK, logistics and evidence controls instead of building parallel products.
Their sprint numbers differ. This increment names its outcome; it does not claim
that all work called S3, S9 or S10 in those different plans is complete.

The product audit permits independent API, web and dashboard deployments. A single
SHA or indiscriminate merge is not the acceptance criterion. The real requirement
is a reconstructible, compatible combination of exact sources and deployments.
The existing S9 candidate documents and migration 0112 gate remain authoritative
historical references, not proof of current production state. No deployment or
migration was performed by this increment.

## Gap verified in the current source

In `leads-tickets-client.tsx` (original blob
`361f5047668885dccb7537df97fcf0e09dd1fe6d`), the top dashboard:
- counted words such as meeting/private/call as meetings;
- combined closed prospects and completed orders under won/closed;
- connected counts from different entity types as a commercial funnel;
- mixed leads and tickets as acquisition leads and assigned web_bot to absent sources;
- displayed array length zero even when the collection was unavailable.

These are source-code findings, not a claim that a particular customer saw a
production incident. The existing server-side collection availability and
provenance are sufficient for the display correction; no new storage is needed.

## Implemented outcome

The top section now shows three independent loaded samples: prospects, support
tickets and order requests. Each card uses its own existing collection state.
Unconfirmed, unavailable and denied sources have no numerical count. Explicit
confirmed empty sources retain zero. Demo counts require matching explicit demo
context and are labeled. Tenant mismatches, duplicate identities and malformed
rows make only that source unconfirmed. Different entity types and authorized
global tenant identities are not merged into people or a conversion denominator.

A disclosure shows literal recorded statuses, including unknown and missing
values, without relabeling closed as won or inventing a new/open default. The
projection excludes contact details and free-form notes. It does not infer sales,
meetings, acquisitions, revenue, unique people, freshness or total history.

Three local actions open the existing inboxes, clear the local search and move
keyboard focus into the existing workspace. They create no request or business
write and preserve the existing server-provided tenant context. New copy is
complete in Spanish, English and Portuguese. Scoped light/dark styles retain
44px controls, keyboard focus and bounded scrolling. No new design system,
provider, dependency, polling loop or paid feature was added.

## Validation

Locally on Node 22.16.0, 27 new Node tests passed with zero failures/skips.
The source model was executed with native TypeScript stripping. Focused strict
typechecking used the upstream collection type declaration copied into the local
subset; JSX/TypeScript syntax was also checked. This is not a local monorepo
build or a claim that the full dependencies were installed in this environment.

The existing branch-specific acceptance workflow is reused: full dashboard
suite, typecheck, production build, secret gate, unchanged support browser
harness, plus the new actual-workspace CRM browser harness. The new harness
covers three locales, two themes, six viewport widths, keyboard navigation,
search clearing, scope changes, demo and unavailable states. Its data and
transport are explicitly synthetic and Next navigation is stubbed. CI results
must be verified against the exact new commit before claiming a pass. Automated
browser checks do not certify a production session or a manual accessibility audit.

## Verified CI result

Exact runtime source: `d2758dce665ef0c320e08df3808d529b574b94ce`.
GitHub Actions run [35786823244](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35786823244),
job `106945541588`, completed successfully on its first attempt on September 22,
2026. The run result was read after completion; counts below came from its logs.

- Dashboard: 1,078 tests total, 1,076 passed, zero failures/cancellations and two
  pre-existing optional browser skips. The 27 new tests are included, not added
  on top of that total.
- Dashboard typecheck, static QA, production build and secret custody gate passed.
- Existing support browser harness: 296 checks in 24 views, no failures.
- New actual-workspace CRM harness: 547 checks in 36 locale/theme/viewport
  combinations, no recorded page errors. Its scoped axe and overflow assertions
  passed. Real parent keyboard navigation, search clearing, retained scope and
  no business requests were checked.

The harness used synthetic data and stubbed Next navigation. It did not certify
an authenticated production session, backend integration, physical NFC, the
whole enterprise gate suite or a manual visual/accessibility audit. Screenshots
were generated on the ephemeral runner, not manually inspected or uploaded.
This documentation-only addendum does not alter the runtime source above.

## Next plan blocks and boundaries

1. Recheck current migration and provider authorization gates before a coordinated
   API/dashboard release. Do not promote the previous deployment as this patch.
2. Continue the CRM's remaining legacy collection/provenance and assistant-view
   semantics audit. This patch replaces the overview, not every legacy tab,
   backend endpoint or the entire CRM permission model.
3. Reuse existing DPP, member timelines, support lookup and recall workflows for
   a combined acceptance ceremony, separately marking physical NFC, authenticated
   production, external providers and unexecuted gates.
4. Defer paid dispatch, brokers and capacity upgrades. Standard public-repository
   CI is reused with no artifact upload, persistent cache, deployment or DB writes.

No change to SUN/SDM, TTStatus, keys, tenant grants, API, web, database schema,
main, existing release markers, branch protections, billing, or production data.
