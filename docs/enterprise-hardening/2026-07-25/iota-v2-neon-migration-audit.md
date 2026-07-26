# IOTA V2 / Neon staging migration audit

Date: 2026-07-25 (live evidence updated 2026-07-26)
Scope: gated rehearsal, backup and apply on the allowlisted Neon staging branch

## Intended staging target

- Provider: Neon
- Branch ID: `br-round-shadow-aibqkvgz`
- Endpoint ID: `ep-solitary-surf-aiixcsmk`
- Database: `neondb`

The previously recorded endpoint `ep-fancy-morning-ai5gdrnd` belongs to the
main branch, not staging. Its evidence remains rejected. Every live action below
was bound instead to `ep-solitary-surf-aiixcsmk` and its captured pre-change
fingerprint.

## Schema and data state

The controlled IOTA migration set contains seven ordered migrations:

1. `0050` evidence anchor `reconciling` enum
2. `0051` IOTA V2 evidence writer schema
3. `0052` durable webhook outbox
4. `0053` admin login abuse guard
5. `0054` IOTA executor publication table
6. `0055` durable signed/broadcast state machine
7. `0056` validation of the two IOTA V2 evidence constraints

The expected baseline ledger (`0050`-`0054`) was verified independently on
staging, its backup and the disposable rehearsal branch. All three matched the
pre-change schema fingerprint
`sha256:37cfdf9ab5acb03c0262be25f9a9fcaa2a6a7cfd429d0c5311c26c0f0eae5648`.
A bare `db:migrate` must never run unscoped against this target.

## Chain evidence

The independent IOTA read-only gate passed: chain `1076`, contract
`0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`, schema version `2`, expected
bytecode fingerprint and authorized publisher. This proves read availability;
the separate live canary is required to prove writes and reconciliation.

## Live gate evidence

- Local migration-gate tests cover the seven-file ledger and require `0056` in
  both manual postcheck and rollback evidence SQL.
- Local migration-safety checks require both `VALIDATE CONSTRAINT` statements
  in `0056`; the runner owns every transaction boundary.
- Backup branch: `br-weathered-thunder-aiydi39a`, endpoint
  `ep-mute-dawn-aitzp4vm`. It remains at the verified pre-change fingerprint.
- Disposable rehearsal branch: `br-red-sound-ai1g5h9y`, endpoint
  `ep-broad-heart-ait7wlm0`. Migrations `0055` and `0056` rehearsed successfully.
- Staging: `0055` and `0056` applied through the allowlisted wrapper only after
  backup and rehearsal evidence matched.
- Rehearsal and staging both reached post-change fingerprint
  `sha256:f974a89df3f139c801620c98997748af505300694a66171379725ccf17f428eb`.
- Live postcheck returned `production_ready: true`: required tables, columns,
  valid indexes and validated constraints are present, with zero incompatible
  rows.

## Fixed control boundaries

- Migration commands require `STAGING_DATABASE_URL`, an unpooled Neon endpoint,
  exact endpoint allowlist and full expected baseline ledger.
- The connection upgrades SSL to `verify-full` without printing the URL.
- The apply wrapper binds approval to the captured pre-change schema fingerprint,
  backup reference and disposable-branch rehearsal evidence.
- The generic runner blocks sparse-ledger global replay, embedded transaction
  controls and unbounded DDL locks.
- Postcheck covers all `0055` columns, constraints, indexes and state values,
  requires both evidence constraints to be validated by `0056`, and emits
  `production_ready: true` only when every check passes.
- Rollback is Neon snapshot/branch restore plus exact fingerprint verification;
  no destructive down migration is provided.

## Release-gate result and residual risk

The live IOTA testnet canary passed on 2026-07-26. Receipt, emitted event,
contract storage and the single durable PostgreSQL row agreed; an exact replay
returned the same transaction and nonce, while the publisher nonce advanced
exactly once. The temporary owner database secret version was then disabled and
the legacy Polygon service account lost decrypt access to the IOTA wrapping key.

Crash recovery and concurrent same-proof stress remain required before this
staging evidence can support a production-SLA claim. Custody is Google Cloud KMS
`SOFTWARE` envelope encryption, not Cloud HSM and not non-exportable transaction
signing; this distinction must remain explicit in sales and compliance claims.
