# Dashboard .35 — confirmed CRM inboxes and assistant records

Continuation base: `c5eefe1c1f80aee6444b2338a0384a18e4e0a70b`.
Prior runtime: `702829269506758dbf1f969d0627a71083a80c87` (.34).
API protocol prerequisite: `2026.09.22-api-support-workflow.2`.

## Plan outcome and verified gap

Continue the supplied September 17 audit: simplify the existing customer
workspace, distinguish missing information from zero, preserve tenant authority,
and reuse existing controls rather than create a parallel CRM or data store.

The prior assistant panel treated the remainder of lead notes as a recorded
answer, inferred responded state from those notes, classified free-text mentions
as assistant records, and offered fixed illustrative conversations. Source review
of the existing Web/API assistant capture paths shows that these lead records
contain questions and metadata, not a persisted outgoing answer. This is a
source-code finding, not an assertion that a specific customer saw an incident.

The server loader also silently dropped non-object rows and the page subsequently
filtered foreign tenants while retaining a successful collection state. A mixed
or malformed response could consequently look like confirmed zero activity.

## Implemented

- Reuse the existing activity projection to validate each inbox independently:
  source provenance, session mode, tenant assignment, identity uniqueness and
  display-field bounds. Malformed/foreign rows invalidate their collection;
  they are not silently removed to manufacture a smaller successful sample.
- Validate authenticated BFF production/demo headers before passing inbox rows
  into client props. Keep the existing server-side lead permission check and
  independent ticket/order/member authorization paths. The UI check is defense
  in depth, not a substitute for API authorization.
- Reuse the existing shared request deadline for collection headers and JSON.
  Requests remain no-store, refuse redirects, and forward only the existing
  page context. A timeout cannot leave the server loader awaiting an ignored
  cancellation indefinitely. This does not change the separate member-timeline
  loader or claim that every platform request now has this deadline.
- Replace the assistant dashboard with source-labelled lead records from the
  four exact existing assistant channels. Notes remain notes; questions remain
  questions; states remain prospect states. No answer, delivery, conversion,
  live-session count or complete conversation history is fabricated.
- Remove fixed local illustrative assistant conversations. Explicit demo data
  may still be shown when the authenticated source and session both label it
  demo. Demo and operational rows cannot be mixed as confirmed activity.
- Use distinct unavailable, denied, malformed, empty and no-search-match states.
  Unknown dates, quantities and statuses are not replaced by zero/new/answered.
  A recent-ticket-list failure does not disable the independent exact lookup.
- Keep all six existing inbox destinations, with localized labels and semantic
  tabs, arrow/Home/End navigation, visible focus and 44px controls. Manual retry
  refreshes the existing route and preserves session/tenant context; it creates
  no business record. Denied access does not offer a misleading retry action.
- Paginate assistant records twenty at a time within the loaded sample. Search
  resets the effective page, context changes hide stale records, and source
  notes are collapsible. New controls and messages support Spanish, English
  and Portuguese in both themes. Older unchanged table/page copy is not claimed
  fully translated by this increment.

## Executed local acceptance

On the final runtime changes, Node 24.15.0:
- Dashboard suite: 1,132 total, 1,130 passed, zero failures/cancellations and two
  existing optional browser skips. Includes 33 new model/server-loader tests.
- Dashboard typecheck, production build, static checks and secret custody pass.
- Existing enterprise dependency audit passes: no production high/critical
  findings and no temporary development exceptions. No dependencies or
  allowlists were changed in this increment.
- Extended actual-workspace browser harness: 1,021 checks in 36 locale/theme/
  viewport combinations, no page errors. Includes assistant source filtering,
  denied/foreign/malformed/demo states, pagination, search clearing, contextual
  retry, keyboard tabs, overflow and scoped automated accessibility checks.

The server-loader tests execute its actual transpiled function with only the
external page transport injected. Browser tests render the real parent/component
with synthetic records and stub Next navigation. These are not authenticated
production, physical NFC, external AI-provider or complete enterprise acceptance.
The support harness retains all prior assertions, with fixtures corrected to
supply explicit tenant assignment and consistent demo/operational context.
It switches to a simulated operational session before mocked ticket lookup;
all records and API responses remain synthetic. Locally it passed 296 checks
in 24 views. The retained MapLibre harness passed 29 checks in four views.
Earlier shape-only tests were updated to follow the extracted implementation;
the assistant no-answer test now executes the model rather than requiring the
old erroneous notes-to-answer expression.

## Release and continuity boundary

The .35 marker identifies this candidate and the compatible API .2 prerequisite.
No SQL migration, promotion, domain mapping, tenant grant, consent change,
provider message, SUN/SDM, TTStatus, key or external paid service is changed.
API, Web, packages, lockfile and map runtime remain unchanged from the .34 tree.
The historical .34 and API .2 candidate records are preserved.

GitHub CI and Vercel results must be checked against the new exact commit before
recording acceptance. A READY candidate is not a production promotion receipt.
Migration 0112 still needs its separate specific confirmation; generic requests
to continue development are not recorded as that migration approval.

Next coherent block: continue the existing task-oriented DPP/consumer/support
acceptance with real authenticated sessions once the release prerequisites are
satisfied; keep physical TAP evidence and business-event evidence distinct.

## Verified GitHub and Vercel results

Runtime `183ff4173a545edd39e7afe3902f5e99bdfb6078` was pushed by normal
fast-forward to the same remote continuation branch. Actions run `35809985570`,
job `107019173089`, passed on its first attempt at 2026-09-23T02:24:36Z
(September 22 in Argentina). Completed logs were read: 1,130 passed, zero
failed/canceled, two existing optional skips; typecheck/build, dependency audit,
secret custody, support 296/24, CRM 1,021/36, and two map runs of 29/4 passed.
One map run used assets served by a real Next production server. All browser
records and transports were synthetic; this does not certify a real tenant login.

Vercel built one new .35 candidate on the existing dashboard project:
`dpl_6aYY1fSwaBtBLwvB7gAJiYHqoQjH`, READY, with native Git source equal to the
exact runtime above and `autoAssignCustomDomains: false`. An authorized Vercel
CLI read returned `/release.json` identical to the committed marker and fetched
`/novedades` with .35 and the new source/assistant cards. Those are HTTP checks,
not a full authenticated application browser acceptance.

The local mobile/light and desktop/dark assistant captures were inspected after
the final layout adjustment. Support fixture scope was corrected before the
single successful CI run; no guard or failing assertion was disabled.

Final provider reads retained production API `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V`
and Dashboard `dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`. No migration or promotion was
requested. API, Web, packages, dependencies and Actions definitions stayed
unchanged. The three ticket contract modules remain byte-equivalent to .34,
which was the independently validated API .2 paired-model input. This does not
claim that a new authenticated combined release ceremony has been completed.

The .35 candidate manifest records this evidence; prior .34/API .2 records are
not overwritten. A documentation-only follow-up records the results without
changing the tested application or causing another application build.
