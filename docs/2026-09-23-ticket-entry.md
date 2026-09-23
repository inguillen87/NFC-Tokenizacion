# Open the ticket from its inbox

Dashboard .38 continues .37 on the existing CRM. A confirmed ticket row or signal
now offers **Abrir ticket**. The action queries the existing authorized reader
with that exact UUID and the current organization, switches to Tickets, and
focuses the case. Rows remain locators, never permission or provenance evidence.

The reader remains mounted between inbox tabs. Opening a different case, editing
the reference and changing internal tabs are blocked synchronously while a status
write is pending or unresolved. The inbox refresh control is disabled on the
resulting render; it does not have a separate same-event-turn imperative guard.
The original command
and idempotency UUID remain available to retry. This also covers a second click
before React has rendered the disabled controls. A scope or permission change
still clears the prior scope; returning to an earlier organization or permission
state cannot restore a stale navigation lock. This is not persistence across a
page reload.

The action is absent for demo, unavailable, duplicate, foreign-tenant or invalid
rows and sessions without the existing lookup permission. No read runs on mount,
hover or focus. Opening the case sends no PATCH and does not open its history
automatically. Counts and exports retain the original confirmed sample.

## Validation

- Dashboard unit suite: 1,198 passed, zero failed, two existing optional skips.
- Focal suite: 139 passed (overlaps the complete suite).
- TypeScript passed.
- Browser: 504 checks in 30 views; zero axe findings, overflow, browser errors,
  unexpected requests or external connections. Mobile light and desktop dark
  captures were inspected. Spanish, English and Portuguese entry controls passed.
- Browser uses actual components and Chromium with synthetic records/transport
  and stubbed Next navigation. It is not production ticket-write acceptance.
- Production build, dependency audit and secret custody gate passed locally.
Exact-commit CI and deployment receipts are recorded separately after
  completion; none is implied by the counts above.

No API, database, NFC configuration, TTStatus, notification or new service is
introduced by this increment. It does not close the entire M-04 roadmap.

## Production baseline recovered during this work

The existing API .2 and Dashboard .37 artifacts were promoted on September 23,
after verifying native Git SHA, READY, production target and their successful
GitHub runs. See the separate production receipt. Those promotions did not
include .38 code. Migration 0112 is now applied; older candidate documents that
say it is pending describe their historical observation, not the current state.

## Final publication

Runtime `6c37248dd48a7edff8712b25071772cb5f75e97d` passed GitHub Actions
run `35819212821`, including the full unit suite, production build, support,
CRM, member history, batch navigation and two map runs. CI recorded 506 support
checks; the local browser run recorded 504. These are separate runs, not additive
counts. Both used synthetic records and transport for business requests.

Vercel deployment `dpl_MQzHkHGoNQW3kGmp95XQkwB2j6DS` was built from that native
Git SHA, then promoted after CI succeeded. `app.nexid.lat` resolves to it;
`/release.json` matches the committed Git blob byte for byte and `/novedades`
contains .38 and the new entry instructions. The existing real tenant session
still reads CRM, identifies its empty ticket source and preserves member access
denial. No production ticket or customer record was created or edited for QA.

Full operational status-change/receipt acceptance and populated member history
remain separate from these limited authenticated reads. No physical TAP is
certified by this release. Exact pointers, validation and superseded candidate
identity are in `releases/2026-09-23-dashboard.38.candidate.json`.

## Next bounded work

The roadmap still calls for an explicit responsible person and next action on
customer activity. That needs its own authorized data contract and audit trail;
the current inbox correctly reports when the source has not recorded them.
Do not infer an owner, deliver a customer message, or reuse a ticket status as a
sales conversion. M-04 also retains its actual operational acceptance work.

The default `scripts/release-preflight.mjs` inventory is an older dated candidate.
It must not be used as the current production inventory: use the exact .38 and
API .2 receipts above when recovering this work.
