# Enterprise migrations 0091–0096 — runtime ACL, RBAC and TT receipt boundary

Migrations 0091–0096 deliberately revoke `PUBLIC` access and do not invent a
production database role. The migration owner passes schema validation by
ownership; that is not proof that a distinct application role has least-
privilege access.

Migration 0094 closes a concrete SUN persistence ACL gap. It makes
`nexid_persist_sun_scan_v1(jsonb)` the only grantable SUN persistence entry
point, executes that wrapper with migration-owner database privileges, fixes its
`search_path` to `pg_catalog, public, pg_temp`, revokes `PUBLIC` execution from
the wrapper and both internal SUN bases, and revokes `PUBLIC` `CREATE` on schema
`public`. The internal base retains `SECURITY DEFINER` and the same hardened
path as a private implementation detail; it must never be granted to an
application role.

Migration 0095 repairs one PostgreSQL/PL/pgSQL ambiguity without replacing the
physical NFC flow: the durable TT receipt insert now targets the named
`sun_tt_truth_receipts_pkey` constraint instead of using the ambiguous column
list `ON CONFLICT (event_id, event_created_at)`. The migration fails closed
unless that primary key is exactly `(event_id, event_created_at)`, replaces one
and only one occurrence in the existing base function, reasserts the 0094 ACL
and hardened search paths, and keeps its capability probe private. It changes
no CMAC, SDM, TTStatus, replay or counter semantics and makes no KMS/HSM claim.

Migration 0096 adds the authoritative enterprise role catalog, tenant-bound
resource grants with explicit deny precedence, durable serialization of
membership/permission changes per user and tenant scope, tenant-owned dual
control for production QA plans, and a versioned deterministic risk projection
that never rewrites canonical events. It also repairs historical function ACLs
created by `ALTER FUNCTION ... RENAME`: existing non-owner grants are migrated
to the public manifest/SUN wrappers and removed from the renamed internal
implementations. It also binds the wrapper and both internal SUN stages to the
same owner and exact `pg_catalog, public, pg_temp` path: the wrapper and current
base remain `SECURITY DEFINER`, while the historical primitive remains private
`SECURITY INVOKER`. The authority lock helpers and risk backfill remain private.
This is an authorization and database-integrity boundary; it changes no NFC
SUN/SDM/CMAC, TTStatus, key envelope or blockchain semantics.

Before a production rollout, substitute the actual configured runtime role and
grant only the access exercised by the application. At minimum, the release
preflight must prove the following without granting trigger or internal base
helpers as public API entry points:

| Surface | Required runtime boundary |
| --- | --- |
| Keyless carrier QA | `EXECUTE` on `nexid_supplier_carrier_qa_v1_capability()` and `nexid_commit_supplier_carrier_qa_v1(jsonb)`; `SELECT,INSERT` on `supplier_qa_carrier_evidence_receipts`. |
| Keyless production acceptance | `EXECUTE` on `nexid_supplier_keyless_qa_activation_v1_capability()` and `nexid_supplier_keyless_production_activation_receipt_v1(uuid)`; `SELECT,INSERT` on `supplier_keyless_production_qa_acceptance_receipts`. The unified production receipt/assert/activation functions remain governed by the existing 0076 ACL checks. |
| Carrier-scope integrity | `EXECUTE` on `nexid_supplier_carrier_scope_integrity_v1_capability()` and the public `nexid_import_tag_manifest_v2(jsonb)` wrapper. Do not grant the renamed 0081 core helper or trigger helper as a client entry point. |
| Durable TT truth | `EXECUTE` on `nexid_sun_tt_durable_truth_v1_capability()` and `nexid_persist_sun_scan_v1(jsonb)`; `SELECT,INSERT` on `sun_tt_truth_receipts`. Update/delete remains blocked by the append-only trigger. |
| SUN persistence authority | The runtime role receives `EXECUTE` only on `nexid_persist_sun_scan_v1(jsonb)`, never on `nexid_persist_sun_scan_v1_base_0062(jsonb)`, `nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)` or the private 0095 capability. It must have no `CREATE` on schema `public`; 0094/0095 require these conditions so a fixed `SECURITY DEFINER` search path cannot resolve runtime-created objects. The base function must contain the named-primary-key conflict target and no ambiguous column-list target. |
| Enterprise authority serialization | Runtime mutations enter through reviewed public writers. Never grant direct `EXECUTE` on `nexid_touch_authority_scope_lock_v1(uuid,uuid)` or `nexid_serialize_authority_scope_v1()`, and never grant direct table access to `enterprise_authority_scope_locks`. |
| Risk projection | Reads use the tenant-scoped API projection. The private `nexid_backfill_event_risk_v1(integer)` writer and `event_risk_projections` table are not application entry points and do not modify canonical events. |

The authoritative check is
`apps/api/scripts/db-enterprise-release-preflight.mjs`. After grants, run it as
the actual directly authenticated runtime database role and archive only its
non-secret JSON result. `NEXID_RUNTIME_DB_ROLE` must equal both PostgreSQL
`session_user` and `current_user`; an owner connection using `SET ROLE` is not
acceptable. The preflight must also reject inherited/SET-able owner or dangerous
roles and verify the exact SUN `SECURITY DEFINER` owners and hardened
`search_path` values rather than trusting the migration ledger alone.
Also capture `information_schema.role_table_grants`,
`information_schema.routine_privileges` and the enabled trigger inventory for
the release evidence package.

Before a production role exists, the disposable-Neon proof is:

```powershell
npm.cmd -w api run db:enterprise-runtime-role:qa
npm.cmd -w api run db:authority-scope:qa
```

That validator creates a randomized `NOLOGIN`, `NOSUPERUSER`, `NOCREATEROLE`,
`NOCREATEDB`, `NOBYPASSRLS` role inside one transaction, grants only the table
and function surface above, calls the five public capability probes, proves
that the role cannot create objects in schema `public`, verifies the internal
SUN bases remain non-executable, proves actual permission denials for an
internal manifest helper, raw batch-key reads, receipt updates and receipt
deletes, then rolls the transaction back and proves the role no longer exists.
The authority-scope validator additionally races permission insertion against
membership deletion and two last-membership deletions under `READ COMMITTED`
and `REPEATABLE READ`. It requires one commit, one `23514`/`40001` rejection,
zero orphan grants and a durable lock-row write. It rejects pooled Neon
endpoints because its two-connection/session-lock protocol requires backend
affinity.

Neither validator executes against production. The runtime-role validator does
not execute business mutation functions, does not create or change a
production role and is not a substitute for running the release preflight as
the eventual production runtime role.

## Disposable-Neon evidence — 2026-08-02

The earlier 95/95 migration receipt through 0093 and incremental 0094 runtime-
ACL receipt remain historical checkpoints. Current sanitized evidence proves a
stronger but still bounded state:

- `evidence/neon-disposable-full-migration-validation-0095.json` records two
  independent empty disposable-Neon installations passing all 97 migrations
  and postchecks through 0095.
- `evidence/neon-disposable-runtime-role-acl-0095.json` records the
  transactional ephemeral role on the 97-migration schema, including exact
  wrapper grants, private-helper and `batch_keys` denials, receipt update/delete
  denials, absence of `CREATE` on schema `public`, rollback and proof that the
  role no longer exists.
- `evidence/neon-disposable-sun-tt-postgres-qa.json` records direct-function SUN
  execution with 13 events/13 append-only receipts, concurrency/replay and
  rollback behavior, exact TT raw values `4343`/`4F4F`/`4F43`, fail-closed
  contradiction/missing-raw handling, degrade-only `force_result`, CMAC/SDM
  gates and SQLSTATE `55000` for receipt update/delete.
- `evidence/neon-disposable-supplier-atomic-postgres-qa.json` records supplier
  direct-function atomic rollback, BID/UID races, manifest/carrier/key scope,
  keyless QR with zero key rows, authenticated two-tenant isolation without an
  RLS claim, synthetic Packaging Lab/plan gating, keyless QA and
  activation/archive serialization.

The last two receipts exercise PostgreSQL functions directly; they do not prove
the HTTP routes. The role is a randomized QA role, not the configured
production runtime role. Production was untouched, no physical NFC tag was
scanned, no raw key was archived, and none of these receipts proves managed
KMS/HSM custody, an external webhook receiver, or live Polygon/IOTA execution.

Migration 0096 and its authority-scope races currently have local static and
unit-test evidence only. Until the full chain through 0096 and
`db:authority-scope:qa` pass on a fresh authorized disposable Neon branch, do
not represent 0096 as remotely validated or production-deployed.

Do not grant `PUBLIC`, do not grant internal renamed functions merely to make a
preflight green, and do not run the application as the migration owner. None of
these ACLs changes the physical NFC SUN/SDM/CMAC path. Application AES-GCM
envelope encryption remains software custody and is neither managed KMS nor HSM.
`SECURITY DEFINER` is a PostgreSQL execution-authority boundary, not a
cryptographic key-management service, hardware-backed key custody or HSM
certification. No production database, role or grant was changed by the local or
disposable-QA procedure documented here.
