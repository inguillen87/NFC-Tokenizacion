# API support workflow .2 — security maintenance and paired contract checks

API base: `fd66f4aedc1c238f57d1d967449f37d055e86744`.
Release: `2026.09.22-api-support-workflow.2`.
Dashboard contract source: `702829269506758dbf1f969d0627a71083a80c87` (.34).

## Implementation

This increment applies the dependency maintenance independently to the API
line, rather than deploying the API snapshot carried by the dashboard branch.
Next 16.3.6, Nodemailer 9.1.1, csv-parse 7.0.2, sharp 0.35.4 and PostCSS 8.5.23
are pinned. Shared workspace manifests also pin MapLibre 6.4.1; nanoid, adm-zip
and qs overrides retain the patched resolutions used by the dashboard release.
No exception or severity threshold in the dependency audit was changed.

All existing API handlers, SQL migration 0112, SUN/SDM, TT interpretation,
tenant authorization and business operations remain byte-equivalent to the
API base. This is a dependency/runtime maintenance release, not new ticket SQL.
The public marker distinguishes .2 while identifying protocol compatibility
with .1. Do not deploy Web or Dashboard from this API-only release tree.

## Added verification

Fourteen lock/manifest regression cases reject obsolete direct or nested
versions and contradictory workspace resolutions. The explicit local command
`node scripts/qa/run-s9-api-security.mjs` runs these checks with the existing
CSV-manifest and OTP/provider tests in a credential-free environment and with
external network access denied by the existing loopback-only test guard.

The paired PostgreSQL harness executes the real migration, API handlers and
three exact pinned dashboard modules. It checks the normalized source hashes
before importing the UI implementation; no rewritten UI model is substituted.

The paired checks cover saved receipts, lost responses after commit, exact
idempotent retries, reconciliation by reading history, competing revisions,
foreign tickets, revoked membership and unavailable databases. Session resolution
is injected and the BFF provenance header is simulated explicitly. This is a
cross-layer contract test, not authenticated browser or production acceptance.

## Local results on the final application candidate

Node 24.15.0; PostgreSQL 17.11 from the official EDB Windows binary archive.
The engine was started only on loopback in a new disposable test directory, not
installed as a Windows service. The test target rejects production/remote URLs;
production credentials are omitted from the Node test process environment.

- Focal API tests: 234 passed; zero failures or skips.
- Dependency, manifest and OTP/provider suite: 57 passed; zero failures or skips.
  This includes the 14 newly added dependency assertions.
- API production build regression suites: 1,296 test executions passed, followed
  by a successful production build and secret custody check.
- Disposable PostgreSQL: 46 passed; zero failures or skips. Includes the 35
  existing support/lookup/workflow cases and 11 paired-contract test entries.
- Existing enterprise dependency gate: zero high/critical production findings,
  with no temporary development exceptions added.

Counts above belong to separate commands and can overlap; they are not summed
into a count of distinct tests. CI results must be read from the new exact SHA.
The paired source test was executed locally, not by the existing CI workflow.
A proposed workflow augmentation was blocked by tool safety; it was not applied
or retried through another path. Existing Actions definitions remain unchanged.

## Release boundary

No application deployment or domain promotion is implied by the preceding
checks. The prepared migration 0112 and its production completion remain a
separate operation; this increment does not edit the prepared payload, migration
ledger, live tickets, NFC configuration or release history.

The latest accepted Dashboard .34 source remains independent. Its recorded .1
API protocol prerequisite is retained by this backwards-compatible .2 runtime,
but compatibility does not prove that either candidate has been promoted.
The prior unpatched API .1 deployment is not an eligible security replacement.
Use a new native-Git Vercel candidate from this exact commit, preserve canonical
baselines, then record actual deployment and promotion receipts separately.

The isolated test schemas were removed by the test harness and its local server
was stopped after validation. No remote PostgreSQL test target was used.

## Verified GitHub and Vercel result

Runtime source: `ebdc5bbc405ca17595d28928d1980a6d1b994282`.
Normal fast-forward push to `codex/nexid-s9-ticket-workflow-api-20260922`.
Actions run `35800339954`, job `106989006421`, completed successfully on the
first attempt at 2026-09-23T00:05:37Z (September 22 in Argentina).
Logs confirm 234 focal tests, 35 PostgreSQL 18.4 tests, and 1,296 build-suite
test executions, all passing with zero failures/skips in those commands.
The separate 57 dependency/IO and 46 local PostgreSQL checks above were not
executed by this unchanged workflow. The full local npm audit reports eight
low-severity findings and zero moderate/high/critical findings.

New API deployment `dpl_3U3zPRtqEbb7iyo9sRRRAQFXADf2` reached READY on the
existing `nexid-api` project, whose configured root was rechecked as `apps/api`.
Vercel native Git source matches the exact runtime SHA and
`autoAssignCustomDomains` is false. Its protected staging health endpoint
returned HTTP 200 through the authorized Vercel CLI.

The staged `/release.json` read returned HTTP 403 `origin_not_allowed`, also
with the declared client Origin. The application origin boundary was preserved,
not disabled. Therefore release-marker HTTP and authenticated business-route
acceptance remain unverified; READY and health do not replace those checks.

Final provider reads preserved production API `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V`
and Dashboard `dpl_8787xNe8nXJCUX4Yva2cNiHYbA3q`. The independent Dashboard .34
candidate `dpl_Dg4e2MbGoLiG6FjPxLGRYuYxqwrt` remains READY on its exact source.
The production database still reports zero migration-0112 rows and no workflow
operations table. No migration completion or promotion was performed.

The specific migration confirmation remains pending. Subsequent release work
must use the prepared 0112 payload, perform coordinated API/Dashboard acceptance,
and record actual canonical-domain promotion and smoke-test receipts. Do not
substitute the older unpatched API candidate or claim the local injected session
represents a real signed-in customer.
