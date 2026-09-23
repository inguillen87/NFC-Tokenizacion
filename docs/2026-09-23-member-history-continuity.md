# Dashboard .37 — recoverable customer member history

Continuation base: `1ef8083a57a6cea57c8af72d5a655e1c9361bf14`.
Previous runtime: `940b15cbdc06d5baca25eb4867925ebb3ab23633` (.36).
Application release: `2026.09.23-dashboard.37`.

## Outcome

Improve the existing customer workflow rather than add another CRM or storage
layer: operators can cancel a slow older-history read, retry that exact page,
retain confirmed activity through transient failures, and explicitly reload
an incomplete history without confusing it with confirmed absence.

Source inspection found unbounded awaits in the member pagination component,
its dedicated dashboard BFF and the initial member-history server loader.
The component reset its visible state in an effect and retained older personal
history after a subsequent forbidden/not-found response. Its partial empty
state could use complete/empty wording. These are source findings; no observed
production customer incident or general platform-wide failure is claimed.

## Changes

- Reuse the existing tested request-deadline helper without modifying it. A
  15-second network-read budget covers both headers and JSON at each modified
  layer and settles independently of a transport ignoring abort. Authentication
  resolution is separate; this is not an end-to-end service latency promise.
- Manual page reader permits one in-flight request and fixed tenant/member/cursor
  parameters. Failed or canceled pages remain retryable. Repeated or cycling
  successful cursors are rejected instead of looping through prior pages.
- Browser reads remain GET, no-store and same-origin; redirects are refused.
  The dedicated BFF keeps its existing permissions, signed session credential,
  scope checks and sanitized response. The bearer is not forwarded through a
  redirect. Caller cancellation is propagated to its upstream read.
- In-flight work is owned by its source snapshot and member scope. A source
  replacement renders its new seed immediately, not old state under a new
  label until an effect. Canceled or obsolete responses cannot append pages.
- Cancel frees the control and restores keyboard focus. Temporary failures keep
  confirmed rows and the requested cursor. Forbidden or missing-member results
  clear visible personal activity; forbidden also hides directory options.
  No dashboard authentication cookie is cleared by a transient upstream 401.
- Partial history stops cursor advancement and offers an explicit route refresh
  from the beginning. It is shown with warning semantics, not a success badge
  or a claim of no activity. Invalid cursor results also offer a fresh query.
- The initial loader now requires confirmed operational BFF provenance. Explicit
  demo sessions do not request this operational history. Existing source-kind,
  timestamp and correlation projections remain unchanged.

No storage, polling, automatic retry, third-party SDK or dependency was added.
The existing Spanish history panel and event presentation remain; this is not
an internationalization overhaul. Release notes describe the increment in the
three existing languages. No business mutation is introduced by these controls.

## Executed local checks

Node 24.15.0, isolated existing dashboard checkout:
- 1,188 total dashboard tests: 1,186 passed, zero failed/canceled, two existing
  optional browser skips. The total includes 29 new tests.
- New tests execute the real reader, actual transpiled BFF handler and actual
  initial loader with only sessions/transports injected. They cover ignored
  abort, hanging body, cancellation, retry identity, invalid scope/cursors,
  both existing permission gates, credential handling and error sanitation.
- Typecheck, production build, dependency audit and secret custody passed.
- New browser harness: 313 checks in eight viewport/theme combinations, no
  page errors; actual component/reader with synthetic records and an explicitly
  noncooperative transport. Keyboard, cancel, timeout, retry, context switches,
  partial/empty/denied states, scoped axe and horizontal overflow checks passed.
- Existing browser regressions: support 296/24, CRM 1,021/36, batch navigation
  1,298/168 with 144 route hops, and standalone MapLibre 29/4 passed.
- Final mobile/light and desktop/dark captures were inspected. The existing
  CI additionally runs MapLibre with worker assets served by Next itself.

Tests do not establish a real tenant login, production business acceptance,
physical NFC, database migration success, external provider latency, or a full
manual accessibility certification. Counts are recorded per harness, not as
unique end-to-end transactions. The existing browser workflow is extended with
one mandatory harness; none of its prior gates or assertions were disabled.

## Release boundary

No change to apps/api, apps/web, packages, dependencies, migration 0112,
cryptography, keys, TTStatus, role grants or production data. The dashboard BFF
is part of this increment, not a new release of the independent API application.
The ticket workflow/lookup/deadline modules and .36 batch navigation are retained.

One grouped application commit and one exact-source Vercel candidate are intended;
CI and provider results must be read for that SHA before a success is recorded.
The earlier .36 and API .2 candidate evidence is historical and is not rewritten.
No production promotion or SQL operation is performed by this increment.
Migration 0112 confirmation, paired authenticated acceptance and canonical
promotion checks remain separate outstanding release requirements.

## Verified GitHub and Vercel result

Runtime `d9efee842e0c652f451e432f0e68e45b03b7476c` was pushed by normal
fast-forward to the same dashboard continuation branch. CI run `35816169955`,
job `107038044040`, passed on its first attempt, completed at
2026-09-23T03:58:16Z. Completed logs were read. They confirm 1,188 total tests,
1,186 passed, zero failures/cancellations and two existing optional skips;
typecheck/build, dependency audit and secret custody all passed.

Existing support 296/24, CRM 1,021/36, batch navigation 1,298/168 (144 route
hops), the new member history 313/8, and both map 29/4 runs passed. One map run
used assets served by a real Next server. The member browser uses the actual
component with deliberately noncooperative synthetic transports and stubbed
Next navigation. It does not replace a real signed-in production user test.
Both final light/mobile and dark/desktop captures were inspected.

After CI passed, one native Git-source candidate was created on the existing
Dashboard project: `dpl_5V4ffDa7E6TEfaLDDm4tKc2nhaLA`. The provider returned
READY with that exact runtime SHA and `autoAssignCustomDomains: false`.
Authorized CLI HTTP reads returned the .37 release marker byte-equivalent as
JSON to the committed file and the new history-recovery release notes.

Final project reads confirmed the original production deployments unchanged:
API `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V` and Dashboard
`dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`. No domain promotion or SQL migration was
performed. The migration ledger was not reread; the separate 0112 gate was not
assumed satisfied. Earlier .36 and API .2 candidate records remain intact.
The documentation-only evidence update does not change the tested application
or trigger another application build.
