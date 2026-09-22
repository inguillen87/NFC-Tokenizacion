# S9 historical ticket lookup — API

Release `2026.09.21-api-support-lookup.1` is active at `api.nexid.lat`.
Runtime source: `8f9494b21b7b4667b41a9d031ca03896fc8e7124`.
Deployment: `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V`.
Immutable URL: https://nexid-i79tlan74-marcelos-projects-c26aa499.vercel.app
Rollback: `dpl_5qh4LDBespy8TgKcmDJG9mHcF2xx`.

`GET /admin/tickets/[id]` retrieves an exact UUID independently of the
latest-300 collection. The existing `leads.manage` authorization runs before
validation or ticket SQL. Tenant principals are bound to their server-resolved
tenant ID and slug. A superadmin can read globally or narrow the lookup to an
explicit tenant; a selector cannot broaden another role's scope. Foreign and
absent tickets have the same 404 response. Missing storage returns 503, without
schema repair, a fake empty result or a business write.

The `nexid.support-ticket-lookup.v1` response contains the reference, display
details, recorded status, creation time, contact and database-owned batch,
event and organization context. It excludes UID and internal support-report
bindings. `detail_state` distinguishes available, not recorded and incompatible
details. Legacy free text remains literal. All responses, including early
authentication and validation failures, are private/no-store/no-referrer.
No migration, new environment setting or notification delivery is required.

[CI 35678616955](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35678616955)
passed on the exact runtime SHA: 224 focal tests, 18 PostgreSQL tests with no
skips (8 lookup, 10 report persistence), 1,296 existing build-suite tests,
production build and secret gate. PostgreSQL 18.4 in CI verified a ticket older
than 305 newer rows, tenant isolation even with shared BID/UID, global and
selected superadmin scope, permission denial before SQL, and missing storage.
The same database suite passed on isolated local PostgreSQL 17.10. Independent
review found no remaining blocking issue.

Staged checks confirmed health 200 and enforced origin-guard 403. Canonical
checks after promotion confirmed the new release/protocol, health 200 and
401/private/no-store on anonymous valid, malformed and tenant-selected lookup
requests. Promotion checked the previous canonical deployment first.
These checks do not certify an authenticated production ticket lookup or a
new physical NFC reading. No production ticket was created or altered for QA.

Dashboard pairing: `2026.09.21-dashboard.32`, runtime
`f5b546e86cf8652401f43041d3d4181eb11eb689`; its deployment evidence is recorded
separately in the dashboard branch. Public web remains
`2026.09.21-web-support.1`. Later documentation commits are not runtime releases.
