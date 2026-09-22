# S9 support reports — API

Release `2026.09.21-api-support.1` is active at `api.nexid.lat`.
Runtime source: `37527be00adf2c6a86d05dab1799e9d9a92e2896`.
Deployment: `dpl_5qh4LDBespy8TgKcmDJG9mHcF2xx`.
Immutable URL: https://nexid-dy3fszs1l-marcelos-projects-c26aa499.vercel.app
Rollback: `dpl_9izrWMLF7AHeHTFdyeDyjAgJnDD4`.

The passport response issues a 15-minute report-only capability after the
event is persisted or its snapshot read is authorized. It is separate from
fresh commercial permissions, excluded from diagnostic persistence and
returned with private/no-store headers. The public BFF can no longer authorize
a report merely by signing a client-supplied event ID.

Public and consumer reports use one writer, scoped to the persisted event,
tenant and batch. A deterministic ticket UUID binds that scope, actor and
client request UUID. PostgreSQL serializes competing writes; identical retries
return the original reference and changed content returns 409. Failed
analytics/realtime publication cannot turn a committed ticket into failure.
Responses contain receipt metadata, never the report's contact or description.
No new migration, runtime DDL, environment variable or notification delivery.

Validation: [CI 35676361487](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35676361487)
passed on the exact runtime SHA: 215 focal tests, 10 PostgreSQL tests with no
skips (18.4 disposable database), and 1,296 existing build-suite tests plus the
production build and secret gate. The same PostgreSQL harness passed 10/10 on
local PostgreSQL 17.10; its isolated schema and process were removed/stopped.
Concurrency tests observe actual PostgreSQL lock waits, including an identity
change while inserting, rollback, conflicting retries and companion failure.

Staged checks confirmed health 200 and the expected origin-guard 403; the
immutable API host remains inaccessible through ordinary public routes.
Canonical production checks confirmed this release/protocol, health 200 and
unauthorized snapshot 404/no-store. Read-only Neon checks confirmed the needed
tickets columns and event 715's persisted tenant/batch/BID consistency.
No report was created in production for QA. These checks do not certify a new
physical tap or an authenticated end-to-end support submission.

Paired web: `2026.09.21-web-support.1`, runtime `6ad72388f60d819cb9b7c72557a0fa5128eebe71`.
Dashboard reference presentation is tracked separately in dashboard.31.
Later documentation-only commits are not runtime deployments.
