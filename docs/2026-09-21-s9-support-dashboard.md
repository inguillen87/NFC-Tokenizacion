# S9 support reference workflow — released

Dashboard `2026.09.21-dashboard.31` is active at https://app.nexid.lat.
Runtime source: `e999f3fed614da8a7ec209dbc07c12718a57d3ea`.
Deployment: `dpl_3ExArPvvG7vWcak3j5i4wc9ZharL`.
Immutable URL: https://nexid-dashboard-o8h9x9ni3-marcelos-projects-c26aa499.vercel.app
Rollback: `dpl_DLPj4Ziq6yZ37RTbGb1kFJLajHTj`.

Tickets and customer signals now show and search the consumer's complete
ticket reference. CSV and Excel retain the same reference and readable details.
The report description is separated from batch, event and category. Identity
comes only from the authorized row; free-form detail cannot change its scope.
Legacy text and unknown JSON remain complete escaped text. Anonymous reports
display missing contact rather than attributing the report to the company.
Shared table inputs and its scroll region are keyboard-accessible.

No server reader, RBAC rule, support-status mutation, database schema or
notification delivery changed. Search is local to the records loaded: the
API returns up to 300 recent tickets; Signals assembles at most 80 recent
signals. The UI and release notes disclose loaded-record search, not a complete
historical lookup. Historical server-side reference lookup remains follow-up work.

[CI 35677195194](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35677195194)
passed on the exact runtime SHA: typecheck, 979 passed dashboard cases, zero
failures and two existing optional browser skips; full production build,
static QA and custody gate. The explicit S9 browser run separately passed
86 assertions and eight desktop/mobile light/dark views, with zero axe
violations, client errors, external requests or page overflow. It uses actual
components/CSS, explicitly synthetic rows and a navigation stub, not Next
server authentication, a real database or production tenant data.
Spreadsheet formula neutralization and HTML escaping remain covered.

Staged and canonical public checks each passed six Novedades views, with zero
axe violations/client errors and anonymous session 401/no-store. Final checks
matched canonical aliases and served markers for all three applications:

| Surface | Runtime source | Deployment |
| --- | --- | --- |
| API `2026.09.21-api-support.1` | `37527be00adf2c6a86d05dab1799e9d9a92e2896` | `dpl_5qh4LDBespy8TgKcmDJG9mHcF2xx` |
| Web `2026.09.21-web-support.1` | `6ad72388f60d819cb9b7c72557a0fa5128eebe71` | `dpl_ABfbegDKHtgTgmZTcX9VZPu155FY` |
| Dashboard `2026.09.21-dashboard.31` | `e999f3fed614da8a7ec209dbc07c12718a57d3ea` | `dpl_3ExArPvvG7vWcak3j5i4wc9ZharL` |

API CI 35676361487 includes 10/10 real PostgreSQL support tests with observed
concurrent locking; web CI 35676032345 includes 672 passing cases and the
actual Next/BFF flow against a synthetic API. No fake ticket or physical NFC
reading was created in production for QA. An authenticated, real submission
and its review by the company remain a separate human acceptance step.

Release notes at /novedades describe support in Spanish, English and Portuguese
and retain the prior physical-evidence and recall boundaries. The original
workspace was preserved; each application uses its existing isolated worktree
on a codex/nexid-s9-support-* branch. Documentation-only commits are not new
runtime deployments.
