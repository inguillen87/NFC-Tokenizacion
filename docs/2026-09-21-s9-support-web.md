# S9 support reports — public web

Release `2026.09.21-web-support.1` is active at https://nexid.lat.
Runtime source: `6ad72388f60d819cb9b7c72557a0fa5128eebe71`.
Deployment: `dpl_ABfbegDKHtgTgmZTcX9VZPu155FY`.
Immutable URL: https://nexid-hsoawjda0-marcelos-projects-c26aa499.vercel.app
Rollback: `dpl_8oEj6dWFyfoarbU5ENxMPK3NDyAG`.

SUN help, risk and Agro report actions open the same in-page form. Category,
description and optional contact are reviewed with the product, batch and
reading before explicit confirmation. Opening support never creates a ticket.
The former commercial-contact detour and Agro analytics-only success are gone.

A successful receipt requires an authoritative ticket UUID, matching event/BID,
tenant assignment and supported status/outcome. Repeated submissions reuse a
frozen request identity and payload. An uncertain result remains unresolved
even after a later authorization failure; the UI cannot silently create a new
request. Expiration copy explains that text remains only on the current screen.
No report details or capability are stored in browser storage or URLs.
The support BFF forwards no consumer session, synthesized share token or UID;
the API validates its dedicated report capability.

Spanish, English and Portuguese forms support keyboard navigation and both
themes. Demo or missing-authority views explain unavailability without sending.

[CI 35676032345](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35676032345)
passed on this exact source: 672 web tests, production build, secret gate, and
actual Next/BFF browser checks against an explicitly synthetic loopback API.
The browser suite passed 17 checks and 18 accessibility/viewport cases, including
double clicks, lost acknowledgements, malformed success, expired authorization,
payload conflict, missing capability and cross-origin rejection.
Actual PostgreSQL and support handler behavior are separately covered by
API CI 35676361487; browser fixture tickets are not production evidence.

Staged and canonical production checks each passed six public demo views,
with zero axe violations, overflow, client errors or attempted writes. Anonymous
consumer access remained unauthenticated. No authenticated production ticket
was submitted for QA and no new physical reading is certified by this release.

Required API: `2026.09.21-api-support.1`, source
`37527be00adf2c6a86d05dab1799e9d9a92e2896`.
Dashboard ticket reference display/search is a separate dashboard.31 increment.
Later documentation-only commits do not change the deployed runtime.
