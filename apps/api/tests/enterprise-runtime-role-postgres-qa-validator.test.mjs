import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertEnterpriseRuntimeRoleAclState,
  ENTERPRISE_RUNTIME_ROLE_FUNCTIONS,
  ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS,
  ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES,
  ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS,
  enterpriseRuntimeRoleName,
} from "../scripts/validate-enterprise-runtime-role-postgres-qa.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("runtime role surface is exact, current through 0096 and excludes internal helpers", () => {
  assert.deepEqual(ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS, [
    "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
    "20260802260000_0091_supplier_keyless_qa_activation.sql",
    "20260802270000_0092_supplier_carrier_scope_integrity.sql",
    "20260802280000_0093_sun_tt_durable_truth_binding.sql",
    "20260802290000_0094_sun_runtime_acl_boundary.sql",
    "20260802300000_0095_sun_tt_conflict_target.sql",
    "20260802310000_0096_enterprise_rbac_risk_truth.sql",
  ]);
  assert.equal(ENTERPRISE_RUNTIME_ROLE_FUNCTIONS.length, 9);
  assert.deepEqual(ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES, [
    "public.supplier_qa_carrier_evidence_receipts",
    "public.supplier_keyless_production_qa_acceptance_receipts",
    "public.sun_tt_truth_receipts",
  ]);
  assert.ok(ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS.includes(
    "public.nexid_import_tag_manifest_v2_core_0081(jsonb)",
  ));
  assert.ok(ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS.includes(
    "public.nexid_persist_sun_scan_v1_base_0062(jsonb)",
  ));
  assert.ok(ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS.includes(
    "public.nexid_backfill_event_risk_v1(integer)",
  ));
  assert.equal(ENTERPRISE_RUNTIME_ROLE_FUNCTIONS.some((signature) => signature.includes("core_0081")), false);
  assert.equal(ENTERPRISE_RUNTIME_ROLE_FUNCTIONS.some((signature) => signature.includes("base_pre_tt_0093")), false);
});

test("ephemeral role names are identifier-safe and bounded", () => {
  assert.equal(enterpriseRuntimeRoleName("0123456789ABCDEF"), "codex_qa_runtime_0123456789abcdef");
  for (const invalid of ["", "abc", "0".repeat(17), "0123456789abcdeg", "a;b".padEnd(16, "0")]) {
    assert.throws(() => enterpriseRuntimeRoleName(invalid), /random_suffix_invalid/);
  }
});

test("ACL state rejects public access, missing grants and append-only mutation privileges", () => {
  const functionRows = ENTERPRISE_RUNTIME_ROLE_FUNCTIONS.map((signature) => ({
    signature,
    exists: true,
    can_execute: true,
    public_execute: false,
  }));
  const tableRows = ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES.map((relation) => ({
    relation,
    exists: true,
    can_select: true,
    can_insert: true,
    can_update: false,
    can_delete: false,
    public_select: false,
    public_insert: false,
  }));
  const internalRows = ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS.map((signature) => ({
    signature,
    exists: true,
    can_execute: false,
    public_execute: false,
  }));
  assert.equal(assertEnterpriseRuntimeRoleAclState({ functionRows, tableRows, internalRows }), true);
  assert.throws(
    () => assertEnterpriseRuntimeRoleAclState({
      functionRows: functionRows.map((row, index) => index === 0 ? { ...row, public_execute: true } : row),
      tableRows,
      internalRows,
    }),
    /PUBLIC may execute/,
  );
  assert.throws(
    () => assertEnterpriseRuntimeRoleAclState({
      functionRows,
      tableRows: tableRows.map((row, index) => index === 0 ? { ...row, can_update: true } : row),
      internalRows,
    }),
    /may UPDATE append-only receipt/,
  );
  assert.throws(
    () => assertEnterpriseRuntimeRoleAclState({
      functionRows,
      tableRows,
      internalRows: internalRows.map((row, index) => index === 0 ? { ...row, can_execute: true } : row),
    }),
    /may execute internal helper/,
  );
});

test("runtime role validator is disposable, non-production and never makes KMS or HSM claims", async () => {
  const scriptPath = path.join(apiRoot, "scripts", "validate-enterprise-runtime-role-postgres-qa.mjs");
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], { cwd: apiRoot, encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = await readFile(scriptPath, "utf8");
  assert.match(source, /assertSunAtomicPostgresQaTarget/);
  assert.match(source, /CREATE ROLE \$\{role\}[\s\S]*NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.match(source, /GRANT \$\{role\} TO CURRENT_USER/);
  assert.match(source, /SET LOCAL ROLE \$\{role\}/);
  assert.match(source, /has_schema_privilege\(current_user, 'public', 'CREATE'\)/);
  assert.match(
    source,
    /NOT historical_routine\.prosecdef[\s\S]*wrapper_routine\.proowner = base_routine\.proowner[\s\S]*wrapper_routine\.proowner = historical_routine\.proowner[\s\S]*wrapper_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\][\s\S]*base_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\][\s\S]*historical_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\][\s\S]*sun_definer_owner_and_search_path_exact/,
  );
  assert.match(source, /!bool\(sunBoundary\.sun_definer_owner_and_search_path_exact\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
  assert.match(source, /role_removed_after_transaction_rollback: true/);
  assert.match(source, /business_mutation_functions_executed: false/);
  assert.match(source, /software_envelope_claimed_as_kms_or_hsm: false/);
  assert.match(source, /managed_kms_validated: false/);
  assert.match(source, /hsm_validated: false/);
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(source, /DROP\s+(?:ROLE|DATABASE|SCHEMA|TABLE)|TRUNCATE|DISABLE\s+TRIGGER/i);
});
