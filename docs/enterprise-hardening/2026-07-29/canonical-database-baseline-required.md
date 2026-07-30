# Canonical database bootstrap policy

The canonical migration ledger now replays successfully from empty,
disposable PostgreSQL 16.4 and 18.4 databases. On 2026-07-30 the repository
independently applied all 74 migrations in lexical order on both versions and
completed the isolated enterprise E2E, including SUN-to-incident, API-key
lifecycle, PostgreSQL rate limiting, and signed webhook outbox processing with
an in-process no-network receiver. This is local evidence, not the configured
CI jobs, Neon, staging, production, external webhook delivery, or physical-tag
certification.

Ordinary `db-apply` still returns `canonical_baseline_required` before creating
the migration ledger or applying SQL to an empty database. A generic migration
command must not infer that an empty target is disposable.

Clean bootstrap is available only through the explicit
`--allow-empty-ephemeral-e2e-bootstrap` path. That path independently requires:

1. `NODE_ENV=test` and `VERCEL_ENV=test`;
2. the exact destructive-test confirmation string;
3. a loopback PostgreSQL URL with no query parameters or fragments;
4. the dedicated `nexid_e2e` role and `nexid_e2e[_suffix]` database name;
5. a declared supported PostgreSQL version that matches the server's exact
   `server_version_num`;
6. no Neon endpoint and a writable target; and
7. zero relations in `public`, verified on the same connection before DDL.

Existing databases without an audited migration ledger remain blocked. For an
existing ledgered database, an approved additive historical gap can be applied
explicitly with `--only`; that is not authorization to write production.

Before any production migration, run the pinned PostgreSQL 16.4/18.4 CI matrix
and a disposable staging/Neon branch dry-run, review the schema diff and
rollback plan, then execute the production release gate with the named runtime
role.

## Runtime execution privilege gate

Migration `0072` revokes `PUBLIC` execution on the tokenization preparation and
scope-guard functions. It intentionally does not guess a runtime database role:
none is canonically declared in this repository. The enterprise release
preflight therefore checks `has_function_privilege(current_user, ..., 'EXECUTE')`
for both the atomic preparation function and the supplier commercial-release
guard. Release remains blocked unless the actual deployment role owns those
functions or an administrator has granted that named role explicit execution.
