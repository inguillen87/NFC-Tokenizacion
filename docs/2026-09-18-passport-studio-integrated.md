# Passport Studio — persisted editorial workflow

API release: 2026.09.18-api-passport.1.
Production API baseline: 39dc0f40a62d6792e11c4b075d011db0c6a33af0.
Policy preparation: 78c457fbecbdb49cac3d7468040859fc9f63ab1e.
Isolated integration branch: codex/passport-integration-api-20260918-r1.

## Completed operational slice

Existing batch -> opt-in editorial enrollment -> persisted draft -> save -> submit
-> independent approval or correction request -> atomic publication -> reopen.
The UI can copy a historical document into an editable draft; saving and fresh
review are still required before it becomes public. History is persisted for each
operation; the interface exposes the latest ten movements, not an unlimited audit
explorer. The initial existing product snapshot is reference version zero, not a
previous Studio publication or fabricated approval.

The new admin endpoints resolve tenant and actor using the existing persisted
session. Read, edit, review and publish permissions stay distinct. Creating, last
editing or submitting a draft prevents that identity from approving it. No account,
role or permission is granted automatically. Global admins are not a bypass for
independent approval. At least two authorized people are needed for the full flow.

## Persistence and concurrency

Migration 20260918120000_0104_passport_editorial.sql is additive: one enrollment
flag, heads, history, receipts, public-field fingerprints and transaction helpers.
It does not enroll existing batches or rewrite product data on deployment.
The PostgreSQL function locks request identity and batch/head rows, enforces the
expected revision/content and commits public update, history and receipt together.
Retrying the same actor/tenant/batch/operation/body recovers the original receipt.
Display-name changes do not alter request identity. Conflicting payloads, stale
revisions and foreign scopes are rejected; no automatic retries are introduced.

Managed lots reject the legacy direct product editor. A database trigger also
protects public fields from stale/concurrent legacy writes. Unrelated technical
settings remain outside the editorial projection. Publishing merges the permitted
product fields and their known display aliases; keys, counters and security config
are not copied into editorial snapshots or rewritten by the publisher.

## Tests

Sixteen integrated scenarios ran on a disposable PostgreSQL 17.10 instance on
loopback using the actual service and pure policy: permission/scope rejection,
four concurrent identical starts, changed payload conflict, actor-label replay,
legacy write rejection, unrelated field preservation, concurrent edit winner,
self-approval denial, correction comments, publication, receipt replay, reopen,
and failures injected into history after draft/public changes. The injected errors
rolled back public data, draft revisions and publication version.

Full-stack browser acceptance uses the project Next.js/React dependencies and
this same PostgreSQL/service path behind an explicitly local synthetic session
fixture. It proves save/reload, lost-response reconciliation, distinct reviewer,
publication, preservation of technical sentinel fields, history reuse and viewer
restrictions. It does not use real customer users, tags or TAP URLs.

## Remaining limits

This is the first integrated general/agro editorial slice, not every S4 feature.
It does not implement a private-document repository, external document validation,
multilingual variants of one passport, automatic legal checks, digital signatures,
or organization-wide approval policy configuration. Locale is metadata for the
single editorial document. Preview is not NFC verification and no GPS is requested.
Advanced wine/other-sector fields remain published but are not editable in Studio;
the enrollment screen discloses that before opting in. Default unchanged batches
retain their existing editor. History is application-governed, not tamper-proof
against privileged database administrators. Hashes are content guards, not signatures.

No paid resource, compute increase or new provider is required. The SUN/SDM route
and cryptographic verifier are unchanged. No global SUN migration watermark was
advanced. Rollback before customers enroll may return to the preceding API; after
enrollment, its old editor would be blocked by the protection trigger, so roll
forward or retain the Studio-compatible API rather than silently disable governance.

## Source coordination

Concurrent unpublished changes were observed in shared original worktrees. An
explicit hash-recorded source snapshot was copied into separate integration
worktrees, then schema/service/UI contracts were reconciled and tested together.
The original worktrees were not cleaned, overwritten or merged to main. This
commit is the reproducible integration source, not a claim that every earlier
unpublished worktree had a compatible implementation.

Final validation before commit: dashboard 843 tests, 841 passed, 2 skipped, zero failed. Editorial API suite: 47 passed. Project TypeScript and Next builds passed. Real PostgreSQL integration: 16 checks passed. Integrated browser: four visual cases plus the end-to-end save/review/publication workflow passed. These are pre-production test results, not customer TAP certification.

## Concurrent migration reconciliation before promotion

The existing 0104 migration was installed concurrently while this release was
staged. Its exact function body was retrieved and compared; the difference was
limited to canonical-request/null guards and column qualification. The original
0104 source now records that observed body. Migration 0105 upgrades only that
known SHA-256 to the locally tested target body, or no-ops if already identical;
an unrelated change aborts instead of being overwritten. No editorial data is
rewritten by the corrective migration. Fresh local install runs both migrations.
The final integrated PostgreSQL suite passed 17 cases including missing-request
envelope rejection. This reconciles the schema and release source explicitly.
