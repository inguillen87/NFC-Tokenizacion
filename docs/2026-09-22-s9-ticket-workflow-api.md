# S9 audited support ticket workflow — API candidate

Candidate release: `2026.09.22-api-support-workflow.1`.
Runtime source: `e00c2dd1d497570cfff709e0aa359c0637a9cde1`.
Branch: `codex/nexid-s9-ticket-workflow-api-20260922`.
Deployment: `dpl_9aEr4qT4dppQcdgCZDjB88jnTrGj` (`READY`).
Immutable URL: https://nexid-a3f4svkk6-marcelos-projects-c26aa499.vercel.app
Canonical API remains `dpl_E5e8m2EwWMa1Z86WVJr9Bpd8kD5V` until migration approval and promotion.

`GET /admin/tickets/[id]/history` and `PATCH /admin/tickets/[id]` use
`nexid.support-ticket-workflow.v1`. They require the existing `leads.manage`
authorization before reading input or ticket SQL. Tenant identity is resolved
on the server; missing and foreign references share the same 404 response.
Early failures and successful replies are private/no-store/no-referrer.

The command carries an opaque expected revision, a UUID request identifier,
the target status and a required reason. When present, Idempotency-Key must
match that UUID. The server normalizes line breaks/tabs before validation and
rejects secrets through the existing audit free-text policy. It never logs the
reason or reflects invalid input in an error response.

Migration `20260922100000_0112_support_ticket_workflow.sql` adds a private,
append-only operation table and invoker functions. One PostgreSQL call locks
the active actor, membership and ticket, then commits the state, audit record
and receipt together. Five-second lock waits are bounded. Revision comparison
prevents stale writes; a retry with identical actor/payload returns its receipt
and the independently queried current state, including after a later change.
HTTP enforces current roles and explicit permission denies; SQL serializes
actor suspension and membership removal, not every possible permissions race.

Incident-managed tickets, unassigned tickets and legacy statuses are read-only
in this flow. The history reader uses one MVCC snapshot, pages 50 changes by
opaque sequence cursor, and excludes internal fingerprints, audit IDs, IP and
user-agent data. Existing ticket rows and existing audits are not rewritten by
the migration. The new history begins with changes made through this workflow.

## Validation

[CI 35683108028](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35683108028)
passed on the exact source: 234 focal tests, 35 real PostgreSQL 18.4 tests with
zero skips (17 workflow, 18 existing report/lookup), 1,296 build regression
tests, production build and secret gate. The workflow suite also passed on
local PostgreSQL 17.10. It observes actual lock waits, concurrent retries,
conflicts, audit/receipt insertion failures, actor/membership revocation,
external updates, incident isolation, pagination and append-only enforcement.

Prepared Neon migration `d4472eda-5704-40dd-84a8-53bc96b683d4`:
- Project `young-mouse-14324031`, database `neondb`.
- Parent `br-jolly-butterfly-aivukyzq` (production/default).
- Temporary branch `br-cool-flower-ai0kmuhm`.
- Exact migration and atomic ledger payload retained in ignored
  `artifacts/s9-workflow-neon-migration-context.json` for the completion call.
- A single DO statement uses PostgreSQL Unicode string escaping to preserve
  function-body semicolons through the connector's SQL splitting. The initial
  raw batch was rejected; the parent table/ledger remained absent.
- The committed smoke script ran on the temporary copy against the real schema:
  initial read, isolation, status change, audit, replay, conflict, later change,
  replay without rewinding, history and incident/legacy controls passed.
  Its synthetic rows were rolled back. Postcheck: one ledger row, zero
  operations, zero fixture users/tenants; invoker functions with PUBLIC revoked.

Staged HTTP checks passed health 200 and enforced origin denial for valid,
malformed and selected-tenant lookup/history paths. The staging hostname cannot
exercise authenticated business routes because its origin is intentionally
blocked. No production ticket was created or changed for validation.

## Publication gate

Neon's `complete_database_migration` tool explicitly requires user confirmation
("NEVER run autonomously; always ask the user first"). It has not been called.
Apply the exact prepared payload and clean up only its temporary branch after
approval, verify the parent ledger/functions, then promote API before dashboard.
Recheck canonical deployment IDs immediately before promotion. Keep migration
0112 during an application rollback; removing its history would destroy data.

An earlier unpromoted API candidate `dpl_CPvWwBK5WiNFW6uttizbHNrGtaaU` had an
incorrect manually supplied SHA label and is excluded. Only the candidate ID
and exact source above are eligible for publication. Public web stays on
`2026.09.21-web-support.1`; this work does not certify a physical NFC reading,
TT state, cryptographic authenticity, product return or customer notification.
