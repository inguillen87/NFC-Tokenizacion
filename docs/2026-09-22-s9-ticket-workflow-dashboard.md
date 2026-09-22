# S9 support status changes — dashboard candidate

Candidate release: `2026.09.22-dashboard.33`.
Runtime source: `f9801b68edea728d90ab61a5c7dd4c6963ac23ac`.
Branch: `codex/nexid-s9-ticket-workflow-dashboard-20260922`.
Deployment: `dpl_7iwucwWYVJ86HyRjEvpH1iC9Bv1a` (`READY`).
Immutable URL: https://nexid-dashboard-9s8gkynwd-marcelos-projects-c26aa499.vercel.app
Publication remains gated on API migration 0112 approval and coordinated promotion.
Canonical dashboard baseline: `dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`, release `.32`.

After an exact-reference lookup in Customer support → Tickets, the operator
opens "Gestionar estado y ver historial". A fresh scoped history read supplies
the current state and revision. The operator chooses open, pending or closed,
enters a reason, reviews the reference/organization/batch/change and explicitly
confirms. The interface records no customer message. Incident-managed tickets,
legacy statuses and unassigned tickets explain their read-only status.

The history shows actor, UTC time and reason, with cursor-based earlier pages.
It shows only changes captured by the new workflow. Text remains literal and
escaped. Spanish, English and Portuguese copy covers success, unavailable
history, permission loss, conflict, blocked state and uncertain submission.
The authenticated BFF requires `leads.manage`, refuses demo writes and applies
a 16 KiB bound before forwarding the command. API validation is independently
bounded at 8 KiB and checks the reason and exact command fields.

An uncertain response keeps the reviewed UUID and command frozen for identical
retry, including after a later permission failure. Receipt and current state
are separate: recovering an old operation must not rewind a newer state.
Conflicts require a fresh read and review, preserving the operator's reason.
Identity/scope/demo/permission changes invalidate the component. Confirming
aborts older history reads, blocks reads during submission and restores the
last confirmed view; late GET replies cannot overwrite confirmed PATCH state
or leave the retry hidden behind a loading view. Collection rows and KPIs are
not silently updated from an exact-ticket result.

## Validation and publication boundaries

Local full suite: 1,025 passed, two existing optional browser skips, zero failed.
TypeScript, focused workflow/BFF tests and secret gate passed. The actual body
reader is exercised at its general 512 KiB and ticket 16 KiB limits, including
UTF-8 byte overflow with a false Content-Length.

The browser harness renders actual components with explicitly synthetic data,
mocked transport and stubbed Next navigation: 296 checks in 24 views, zero axe
findings or horizontal overflow. It covers review/confirmation, double clicks,
history/escaping, uncertain retries, later authorization denial, conflicts,
incident read-only behavior, pagination and delayed-reader/writer races. Mobile
light and desktop dark captures were visually inspected; EN/PT review views
were included. It does not certify a real Next-authenticated production session
or a production business write.

CI on the exact candidate: [35683517731](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35683517731)
passed the full suite, production build, secret gate and browser harness.
Staged checks passed the exact release marker, 401/private/no-store for session,
ticket lookup and history without authentication, and six public release-note
views (ES/EN/PT, mobile/desktop, light/dark), with zero client errors, axe
findings or horizontal overflow. These are public pages and denied requests,
not authenticated production business operations.
The earlier `.33` deployment from `99ed29de` is superseded; only
the source and deployment listed above are eligible for promotion.

Required API: `2026.09.22-api-support-workflow.1`, source
`e00c2dd1d497570cfff709e0aa359c0637a9cde1`, deployment
`dpl_9aEr4qT4dppQcdgCZDjB88jnTrGj`, protocol
`nexid.support-ticket-workflow.v1`, migration
`20260922100000_0112_support_ticket_workflow.sql`.
The API branch records the isolated Neon migration evidence and the explicit
confirmation required by `complete_database_migration`. Promote API first,
then this dashboard, after rechecking both current canonical deployment IDs.
Rollback the application aliases if needed; keep the additive audit history.
Public web remains `2026.09.21-web-support.1`. This increment does not certify
a physical NFC read, product authenticity, TT state or physical recall closure.
