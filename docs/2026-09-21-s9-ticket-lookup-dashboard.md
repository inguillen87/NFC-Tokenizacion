# S9 historical ticket lookup — dashboard

Release `2026.09.21-dashboard.32` is active at `app.nexid.lat`.
Runtime source: `f5b546e86cf8652401f43041d3d4181eb11eb689`.
Deployment: `dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`.
Immutable URL: https://nexid-dashboard-eoy434fr6-marcelos-projects-c26aa499.vercel.app
Rollback: `dpl_3ExArPvvG7vWcak3j5i4wc9ZharL`.

In Customer support > Tickets, **Buscar por referencia** retrieves a saved
ticket by its complete reference, including cases outside the latest-300 list.
The result shows the recorded status, creation time, organization, batch,
reading event, contact and reported details. It remains separate from recent
lists, counts and exports. The existing text filter still covers loaded rows.
Spanish, English and Portuguese copy, light/dark styles and narrow screens are
covered. Legacy statuses remain literal; unavailable detail differs from a
ticket with no recorded description.

The server-rendered page and BFF use existing `leads.manage` permissions and
explicit denies. Tenant selection is preserved through the query; a tenant
session cannot widen it. Demo lookup is blocked. The BFF never substitutes demo
data for a failed lookup, and every lookup response is private/no-store.
The client requires the production marker, exact reference, protocol and
matching tenant context before displaying a result. Input changes,
cancellation and tenant/permission/demo changes discard pending results.
Failed queries preserve the reference and are distinct from not found.

[CI 35678881715](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35678881715)
passed on the exact runtime SHA: typecheck, 1,001 dashboard tests (two existing
optional browser tests skipped), production build and secret gate. Eleven of
those tests execute the actual BFF functions and permission policies with
explicitly substituted session/transport; they cover tenant scope, denies,
server-owned credentials, no fallback and private errors.

The separate real-component browser harness passed 186/186 checks across 14
captures, with zero axe violations, overflow or client errors. The historical
case is absent from the recent fixture collection. Checks cover lookup,
loading/cancel, stale results, wrong references and scope, 404/403/503, retry,
malformed responses, unknown legacy status, languages, details and unchanged
exports. It uses synthetic tickets and a mocked lookup transport; it is not a
real authenticated production session or a full Next server exercise.

Staged and canonical production checks each passed six public release-note
views (desktop/mobile, languages and themes), with zero axe violations,
overflow or client errors. Both rejected anonymous session and ticket-lookup
requests with 401/no-store. The canonical deployment was checked immediately
before promotion. The immutable and canonical release markers match .32.

Paired API is `2026.09.21-api-support-lookup.1`, source
`8f9494b21b7b4667b41a9d031ca03896fc8e7124`, deployment
`dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V`. It passed 224 focal, 18 real PostgreSQL
and 1,296 existing build-suite tests. Public web stays at
`2026.09.21-web-support.1`, source `6ad72388f60d819cb9b7c72557a0fa5128eebe71`.

No migration, real ticket creation, outgoing message or new physical NFC
certification is part of this increment. A real authenticated production case
lookup remains unverified. Full historical text search/pagination and audited
assignment/status transitions are follow-up work; this release performs exact
reference lookup only. Later documentation commits are not runtime releases.
