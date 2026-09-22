# Support / CRM production preflight

Base: `0adde116dc2b3559187d34d30d95cdf01353c494`.
Runtime retained: dashboard `d2758dce665ef0c320e08df3808d529b574b94ce`.
This increment changes release tooling and documentation only.

## Current observations, September 22, 2026

- GitHub confirms the continuation branch still includes the validated CRM and
  ticket-deadline changes. Dashboard acceptance run `35786823244` belongs to
  `d2758dc`; API acceptance run `35683108028` belongs to `e00c2dd`.
- The connected Vercel account lists no teams. Reading the recorded dashboard
  deployment with the exact team ID returns 403, requiring reauthentication for
  `marcelos-projects-c26aa499`. The advertised deploy action also returns
  tool-not-found. Neither response is a successful deployment.
- Root `vercel.json` contains `git.deploymentEnabled: false`. It remains unchanged;
  pushing this branch must not be represented as automatic Vercel publication.
- A read-only query on Neon project `young-mouse-14324031`, production branch
  `br-jolly-butterfly-aivukyzq`, database `neondb`, found no `schema_migrations`
  row matching 0112 or support_ticket. No schema or business row was changed.

## Added reproducible check

`node scripts/release-preflight.mjs` reads the bounded candidate inventory from
`docs/releases/2026-09-22-support-crm-candidate.json`. It performs GET requests only
against fixed GitHub/Vercel API origins, with separate scoped credentials,
redirect refusal, response byte limits and a shared header/body deadline.
Provider payloads, environment values and raw errors are never printed.

The check verifies the exact repository, source SHA, branch, workflow, run and
successful conclusion. It cannot substitute a successful run from another
branch or an old deployment. Vercel native Git-source identity is required by
this automated path; a CLI metadata SHA alone stays unproven. Existing validated
CLI artifacts require a separate artifact-evidence review rather than invented
native Git metadata. Candidate identity is not artifact integrity or acceptance.

The new dashboard deployment is intentionally `null`: the old .33 deployment
predates the deadline and CRM fixes. This is an inventory of candidates, not a
claim that all listed source code is already running in production.

Even successful metadata reads leave migration/approval, canonical baseline,
paired authenticated acceptance, manual visual review and production smoke
receipts as separate gates. No code in this tool creates a build, promotes,
rolls back, migrates, changes a plan or rewrites a release marker.

## Verification and execution

31 local Node tests passed on Node 22.16.0 with zero failures or skips. They use
synthetic transport to exercise source mismatch, foreign scope, absent tokens,
HTTP failures, response bounds, cancellation and secret-free reports. Source and
test blob hashes were verified against the locally executed files before push.

The narrow branch-only workflow repeats these tests, verifies the previously
accepted dashboard/package bytes are unchanged, then reads the actual candidate
CI and uses an existing repository `VERCEL_TOKEN` only if available. Missing
access is an explicit blocker (exit 2), not a green deployment. It does not read
or create secrets through an API. No unrelated credentials are searched.

The workflow uses a standard Ubuntu runner, no dependency installation, no
artifact upload and no persistent cache. It skips execution if the repository
is private, preserving the current no-new-spending constraint. It does not
modify the application's existing acceptance workflows or security gates.

## Verified execution result

Tooling commit: `f4f05c40974b5d159704f4b74b999812ca1c40c1`.
Actions run: [35788731984](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35788731984).
Job: `106951813597`. Logs were read after completion on September 22, 2026.

- Unit checks: 31 passed, zero failed, canceled or skipped, on Node 24.15.0.
- Runtime comparison with accepted dashboard `d2758dc`: passed. No new full
  application build was run or claimed for this release-tooling-only change.
- Actual GitHub API reads reconfirmed exact-candidate CI for API `e00c2dd`
  (run `35683108028`) and dashboard `d2758dc` (run `35786823244`).
- `VERCEL_TOKEN` was unavailable to this workflow. The read-only check made no
  Vercel request without that credential and reported `credential_unavailable`.
  This is not proof that no other account, environment or machine has a token.
- The new dashboard deployment remains unrecorded in the inventory; no old
  deployment was substituted. Report: `status: blocked`, `productionChanged:
  false`, `promotionAuthorized: false`, process exit 2.

The overall preflight workflow is therefore FAILED/BLOCKED at the external
prerequisite step, while its tests and runtime-preservation step passed.
Do not report this run as a successful publication or override it to green.
No migration, deployment, promotion or paid resource was requested by the run.
This documentation-only result addendum does not change the tested tooling.

## Remaining production sequence

1. Restore authorized Vercel access for the existing team, not a new project.
2. Recover and review the exact previously prepared migration 0112 payload;
   complete it only with the confirmation required by the Neon completion tool.
   Verify the production ledger/functions. Do not remove additive audit history.
3. Build a new dashboard candidate from the exact accepted source; record the
   actual deployment identity instead of recycling the old .33 deployment ID.
4. Recheck current canonical deployment IDs and paired API/dashboard acceptance;
   promote the API before the dashboard and verify the canonical production URLs.
5. Record actual promotion and smoke-test evidence. Keep Web and executor
   unchanged. A working health endpoint alone is not a production business test.

Provider references used for the implementation:
- https://vercel.com/docs/rest-api
- https://vercel.com/docs/integrations/create-integration/deployment-integration-action
- https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
