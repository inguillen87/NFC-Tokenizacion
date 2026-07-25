# IOTA V2 / Neon staging migration audit

Date: 2026-07-25  
Scope: read-only audit plus local gate hardening; no Neon mutation

## Current target

- Provider: Neon, PostgreSQL 17 (`server_version_num=170010`)
- Endpoint ID: `ep-fancy-morning-ai5gdrnd`
- Database: `neondb`
- Target fingerprint: `sha256:885c4cf0e0e021b9a42149c30250cb5c85c3d9c9f125120c99b5ef102f8da82f`
- Pre-change schema fingerprint: `sha256:f5a76026c6028f9a825f65911d5577096dd851e1cd188139581f030ac9c2e455`
- Ledger fingerprint: `sha256:d02889a68d27f314d251d7bf9fed5797b0f6bc406fcca4445ee22e5e3f23962c`
- Waiting locks: 0; long transactions: 0

The endpoint ID is database evidence. The branch name must still be confirmed in
Neon Console/API before mutation because PostgreSQL does not expose it.

## Schema and data state

All six planned migrations are absent from `schema_migrations`:

1. `0050` evidence anchor `reconciling` enum
2. `0051` IOTA V2 evidence writer schema
3. `0052` durable webhook outbox
4. `0053` admin login abuse guard
5. `0054` IOTA executor publication table
6. `0055` durable signed/broadcast state machine

The current baseline has one local evidence anchor, one evidence event, zero
webhook endpoints and zero webhook deliveries. There are no duplicate anchor
transaction hashes, orphan webhook rows or prospective webhook event-key
duplicates. This is low data-volume migration risk, not authorization to apply.

The repository contains 56 migration files but this target records only 9. A
bare `db:migrate` would see 47 pending files, including historical gaps from
`0003`; it must never run unscoped against this target.

## Chain evidence

The independent IOTA read-only gate passed: chain `1076`, contract
`0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`, schema version `2`, expected
bytecode fingerprint and authorized publisher. This proves read availability,
not a write, KMS signature or database reconciliation.

## Gate evidence

- `npm run test:migration-gates`: 7/7 pass.
- `npm run check:migrations:safety`: pass; runner owns every transaction boundary.
- Live preflight: pass with exact target, ledger and schema fingerprint.
- Dry-run invoked before committed `0050`: failed closed with
  `MIGRATION_LEDGER_MISMATCH_AFTER_0050`; before/after fingerprints matched and
  `rollback_verified=true`.
- Live postcheck before migration: failed closed and enumerated all six missing
  migrations and required objects.
- Rollback verification against the unchanged baseline: pass.
- API proof suite: 48/48 pass.
- Executor suite: 60/60 pass, including durable-store failures before and after broadcast.

## Fixed control boundaries

- Migration commands require `STAGING_DATABASE_URL`, an unpooled Neon endpoint,
  exact endpoint allowlist and full expected baseline ledger.
- The connection upgrades SSL to `verify-full` without printing the URL.
- The apply wrapper binds approval to the captured pre-change schema fingerprint,
  backup reference and disposable-branch rehearsal evidence.
- `0050` is committed alone; `0051`–`0055` are then executed inside one
  rollback-only rehearsal transaction before any remaining apply.
- The generic runner blocks sparse-ledger global replay, embedded transaction
  controls and unbounded DDL locks.
- Postcheck covers all `0055` columns, constraints, indexes and state values.
- Rollback is Neon snapshot/branch restore plus exact fingerprint verification;
  no destructive down migration is provided.

## Remaining blockers before apply

1. Confirm in Neon Console/API that the allowlisted endpoint belongs to the
   intended disposable/staging branch.
2. Rehearse the full sequence on a disposable branch cloned from this exact
   fingerprint.
3. Create and verify a Neon checkpoint of staging and record its ID.
4. Keep IOTA capability disabled until the executor implementation and `0055`
   state machine pass a real PostgreSQL crash/concurrency test.
5. Add a forward migration that validates the two `evidence_anchors_iota_v2_*`
   constraints before any production-ready claim.
