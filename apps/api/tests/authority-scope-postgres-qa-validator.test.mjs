import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertAuthorityScopeQaDirectEndpoint,
  assertAuthorityScopePostgresQaCapabilities,
  assertAuthorityScopeRejection,
  AUTHORITY_SCOPE_ISOLATION_LEVELS,
  AUTHORITY_SCOPE_REQUIRED_MIGRATIONS,
  buildAuthorityScopeFixture,
} from "../scripts/validate-authority-scope-postgres-qa.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("authority-scope QA requires a direct Neon endpoint for session advisory locks", () => {
  const direct = Object.freeze({ hostname: "ep-nexid-qa.us-east-2.aws.neon.tech" });
  assert.equal(assertAuthorityScopeQaDirectEndpoint(direct), direct);
  assert.throws(
    () => assertAuthorityScopeQaDirectEndpoint({
      hostname: "ep-nexid-qa-pooler.us-east-2.aws.neon.tech",
    }),
    /authority_scope_qa_direct_neon_endpoint_required/,
  );
  assert.throws(
    () => assertAuthorityScopeQaDirectEndpoint({}),
    /authority_scope_qa_direct_neon_endpoint_required/,
  );
});

function completeCapabilityRow(overrides = {}) {
  return {
    users: true,
    tenants: true,
    memberships: true,
    resource_permissions: true,
    authority_scope_locks: true,
    touch_function: true,
    serialize_function: true,
    permission_validator: true,
    membership_validator: true,
    permission_serialize_trigger: true,
    membership_serialize_trigger: true,
    permission_constraint_trigger: true,
    membership_constraint_trigger: true,
    advisory_lock_present: true,
    versioned_lock_row_present: true,
    required_migration_applied: true,
    ...overrides,
  };
}

function emptyCounts(overrides = {}) {
  return {
    user_count: 0,
    membership_count: 0,
    permission_count: 0,
    lock_count: 0,
    ...overrides,
  };
}

test("authority-scope preflight requires the complete 0096 lock and constraint contract", async () => {
  const client = {
    calls: 0,
    async query() {
      this.calls += 1;
      return this.calls === 1
        ? { rows: [completeCapabilityRow()] }
        : { rows: [emptyCounts()] };
    },
  };
  const result = await assertAuthorityScopePostgresQaCapabilities(client);
  assert.deepEqual(result.appliedMigrations, [...AUTHORITY_SCOPE_REQUIRED_MIGRATIONS]);
  assert.equal(result.authorityRowCount, 0);
  assert.equal(result.serializationBoundary, "advisory_xact_lock_plus_versioned_scope_row");

  for (const missing of [
    "authority_scope_locks",
    "permission_serialize_trigger",
    "membership_serialize_trigger",
    "permission_constraint_trigger",
    "membership_constraint_trigger",
    "advisory_lock_present",
    "versioned_lock_row_present",
    "required_migration_applied",
  ]) {
    await assert.rejects(
      () => assertAuthorityScopePostgresQaCapabilities({
        async query() {
          return { rows: [completeCapabilityRow({ [missing]: false })] };
        },
      }),
      new RegExp(`authority_scope_qa_0096_capabilities_missing:.*${missing}`),
      missing,
    );
  }
});

test("authority-scope preflight refuses a disposable target containing authority rows", async () => {
  const client = {
    calls: 0,
    async query() {
      this.calls += 1;
      return this.calls === 1
        ? { rows: [completeCapabilityRow()] }
        : { rows: [emptyCounts({ membership_count: 2, lock_count: 1 })] };
    },
  };
  await assert.rejects(
    () => assertAuthorityScopePostgresQaCapabilities(client),
    /authority_scope_qa_authority_tables_not_empty:3/,
  );
});

test("fixtures use explicit isolated identities for both races and isolation levels", () => {
  const fixture = buildAuthorityScopeFixture();
  assert.match(fixture.runId, /^[0-9a-f]{16}$/);
  assert.equal(fixture.cases.length, 4);
  assert.deepEqual(
    [...new Set(fixture.cases.map((entry) => entry.isolationLevel))].sort(),
    [...AUTHORITY_SCOPE_ISOLATION_LEVELS].sort(),
  );
  assert.deepEqual(
    fixture.cases.map((entry) => entry.kind).sort(),
    ["dual_delete", "dual_delete", "insert_delete", "insert_delete"],
  );
  assert.equal(new Set(fixture.cases.map((entry) => entry.tenantId)).size, 4);
  assert.equal(new Set(fixture.cases.map((entry) => entry.userId)).size, 4);
  for (const entry of fixture.cases) {
    assert.match(entry.tenantId, /^[0-9a-f-]{36}$/);
    assert.match(entry.userId, /^[0-9a-f-]{36}$/);
    assert.match(entry.permissionId, /^[0-9a-f-]{36}$/);
    assert.match(entry.userEmail, /@example\.invalid$/);
    assert.match(
      entry.barrierKey,
      /^nexid-authority-scope-qa:[0-9a-f]{16}:(insert_delete|dual_delete)_(read_committed|repeatable_read)$/,
    );
    assert.equal(entry.membershipIds.length, entry.kind === "dual_delete" ? 2 : 1);
  }
});

test("only the canonical constraint errors or PostgreSQL serialization failure count as rejection", () => {
  assert.deepEqual(assertAuthorityScopeRejection(Object.assign(
    new Error("resource_permission_tenant_scope_requires_membership"),
    { code: "23514" },
  )), {
    outcome: "constraint_rejected",
    stage: "deferred_scope_constraint",
    sqlstate: "23514",
    reason: "resource_permission_tenant_scope_requires_membership",
  });
  assert.deepEqual(assertAuthorityScopeRejection(Object.assign(
    new Error("could not serialize access due to concurrent update"),
    { code: "40001" },
  )), {
    outcome: "serialization_failure",
    stage: "scope_lock_row_write",
    sqlstate: "40001",
    reason: "could not serialize access due to concurrent update",
  });
  assert.throws(
    () => assertAuthorityScopeRejection(Object.assign(new Error("lock timeout"), { code: "55P03" })),
    /authority-scope loser must fail by constraint or serialization/,
  );
  assert.throws(
    () => assertAuthorityScopeRejection(Object.assign(new Error("unexpected"), { code: "23514" })),
    /unexpected authority-scope constraint rejection/,
  );
});

test("validator syntax and static contract prove synchronized two-connection races and scoped cleanup", async () => {
  const scriptPath = path.join(apiRoot, "scripts", "validate-authority-scope-postgres-qa.mjs");
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], {
    cwd: apiRoot,
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = await readFile(scriptPath, "utf8");
  assert.match(source, /assertSunAtomicPostgresQaTarget/);
  assert.match(source, /readSunAtomicPostgresQaConfig/);
  assert.match(source, /sanitizeSunAtomicQaFailure/);
  assert.match(
    source,
    /assertAuthorityScopeQaDirectEndpoint\(readSunAtomicPostgresQaConfig\(env\)\)[\s\S]*new pg\.Client/,
  );
  assert.match(source, /endpointLabel\.endsWith\("-pooler"\)/);
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
  assert.match(source, /AUTHORITY_SCOPE_ISOLATION_LEVELS[\s\S]*"READ COMMITTED"[\s\S]*"REPEATABLE READ"/);
  assert.match(source, /\["permission_insert", "membership_delete"\]/);
  assert.match(source, /\["membership_delete_a", "membership_delete_b"\]/);
  assert.match(source, /pg_advisory_lock\(pg_catalog\.hashtextextended/);
  assert.match(source, /pg_advisory_xact_lock_shared/);
  assert.match(source, /waitForBarrierWaiters/);
  assert.match(source, /waitForWinnerAndSerializedPeer/);
  assert.match(source, /authority_scope_qa_scope_serialization_wait_missing/);
  assert.match(source, /SET LOCAL lock_timeout = '8s'/);
  assert.match(source, /SET LOCAL statement_timeout = '15s'/);
  assert.match(source, /SET CONSTRAINTS \$\{lane\.constraintName\} IMMEDIATE/);
  assert.match(source, /exactly_one_transaction_committed: true/);
  assert.match(source, /orphan_count, 0/);
  assert.match(source, /DELETE FROM public\.resource_permissions WHERE id = ANY\(\$1::uuid\[\]\)/);
  assert.match(source, /DELETE FROM public\.memberships WHERE id = ANY\(\$1::uuid\[\]\)/);
  assert.match(source, /DELETE FROM public\.enterprise_authority_scope_locks WHERE user_id = ANY\(\$1::uuid\[\]\)/);
  assert.match(source, /strategy: "explicit_synthetic_ids_only"/);
  assert.match(source, /production_touched: false/);
  assert.match(source, /physical_nfc_cryptographic_path_touched: false/);
  assert.match(source, /managed_kms_validated: false/);
  assert.match(source, /hsm_validated: false/);
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE|DISABLE\s+TRIGGER/i);
  assert.doesNotMatch(source, /managed_kms_validated: true|hsm_validated: true|physical_nfc_cryptographic_path_touched: true/);
});

test("migration 0096 exposes the exact lock row, BEFORE serializers and deferred validators exercised by QA", async () => {
  const migration = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    AUTHORITY_SCOPE_REQUIRED_MIGRATIONS[0],
  ), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.enterprise_authority_scope_locks/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_touch_authority_scope_lock_v1/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(migration, /ON CONFLICT \(user_id, scope_key\) DO UPDATE/);
  assert.match(migration, /SET lock_version = public\.enterprise_authority_scope_locks\.lock_version \+ 1/);
  assert.match(migration, /CREATE TRIGGER trg_resource_permissions_scope_serialize[\s\S]*BEFORE INSERT OR UPDATE/);
  assert.match(migration, /CREATE TRIGGER trg_memberships_permission_scope_serialize[\s\S]*BEFORE DELETE OR UPDATE/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER trg_resource_permissions_tenant_scope[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER trg_memberships_permission_scope[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
});
