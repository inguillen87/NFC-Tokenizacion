# Open the ticket from its inbox

Dashboard .38 continues .37 on the existing CRM. A confirmed ticket row or signal
now offers **Abrir ticket**. The action queries the existing authorized reader
with that exact UUID and the current organization, switches to Tickets, and
focuses the case. Rows remain locators, never permission or provenance evidence.

The reader remains mounted between inbox tabs. Opening a different case, editing
the reference, refreshing the inbox, and changing internal tabs are blocked
synchronously while a status write is pending or unresolved. The original command
and idempotency UUID remain available to retry. This also covers a second click
before React has rendered the disabled controls. A scope or permission change
still clears the prior scope; this is not persistence across a page reload.

The action is absent for demo, unavailable, duplicate, foreign-tenant or invalid
rows and sessions without the existing lookup permission. No read runs on mount,
hover or focus. Opening the case sends no PATCH and does not open its history
automatically. Counts and exports retain the original confirmed sample.

## Validation

- Dashboard unit suite: 1,195 passed, zero failed, two existing optional skips.
- Focal suite: 139 passed (overlaps the complete suite).
- TypeScript passed.
- Browser: 444 checks in 30 views; zero axe findings, overflow, browser errors,
  unexpected requests or external connections. Mobile light and desktop dark
  captures were inspected. Spanish, English and Portuguese entry controls passed.
- Browser uses actual components and Chromium with synthetic records/transport
  and stubbed Next navigation. It is not production ticket-write acceptance.
- Build, exact-commit CI and deployment receipts are recorded separately after
  completion; none is implied by the counts above.

No API, database, NFC configuration, TTStatus, notification or new service is
introduced by this increment. It does not close the entire M-04 roadmap.

## Production baseline recovered during this work

The existing API .2 and Dashboard .37 artifacts were promoted on September 23,
after verifying native Git SHA, READY, production target and their successful
GitHub runs. See the separate production receipt. Those promotions did not
include .38 code. Migration 0112 is now applied; older candidate documents that
say it is pending describe their historical observation, not the current state.
