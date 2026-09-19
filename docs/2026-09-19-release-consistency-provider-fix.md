# Release consistency: provider identity regression and assigned-task observation

## Delivered change

The previous read-only verifier rejected alias identifiers longer than 100 characters.
Authorized Vercel responses for all three NexID domains contained 128-character identifiers.
The deployment checks succeeded, but the complete observation correctly remained blocked.
The limit now accepts bounded opaque identifiers of 1–128 characters. Exact before/after
identity, project, deployment and revision comparisons remain mandatory; no value is truncated.

Thirteen synthetic regression cases cover the boundary, invalid characters, both reads,
and a replacement differing only at character 128. The complete suite passed 127 tests
with zero failures and zero skips on Node 24.15.0. Original verifier commit: 0da5cfc28c52d906120d3bacab7f67e0cccbd2e6.

## Independent observation on 19 September 2026

A concurrent publication moved API and dashboard to the completed assigned-task release
while the inspection was in progress. No additional deployment or promotion was issued
by this verification run, and no parallel implementation was merged over that release.
Observed public releases: API 2026.09.18-api-tasks.1; dashboard 2026.09.18-dashboard.19;
consumer web unchanged at 2026.09.18-web-notices.1.

After the fix, the 11 control-plane/liveness checks passed in a new observation ending
2026-09-19T12:39:42.176Z. Transport was the already-authorized local Vercel CLI, via the
library's injected-reader interface. This was not a run of the token-based CLI entry point.
The initial blocked report and the successful follow-up were both retained privately.

The deployed assigned-task source was separately retested: seven API unit tests and
17 real PostgreSQL scenarios passed. The dashboard suite passed 877 tests, failed zero,
and skipped two. These counts do not include the superseded parallel prototype.

## Limits and privacy

Read-only database checks confirmed that the installed assigned-task function body matches
the locally tested migration, uses SECURITY INVOKER, has PUBLIC execution revoked, and has
its assignment index. No schema changes or business writes were made by this observation.

The authenticated production browser smoke check was not completed: the local Chrome
endpoint did not expose the expected DevTools connection. Existing recorded browser tests
are historical evidence, not a new live-browser or physical-TAP certification.
The control-plane observation is not atomic, is not a deployment permission, and does not
establish full application acceptance, physical returns, or NFC authenticity.

The repository was observed to be public. Raw control-plane reports, database identifiers,
customer counts/configuration fingerprints, browser data and credentials are deliberately
excluded from this commit. Private evidence remains with the authorized operator.
No invitation delivery, user provisioning, notifications, or automatic permissions were added.

The original verifier document describes its original delivery. This addendum supersedes
its 100-character assumption and updates verification evidence without changing its limits.
