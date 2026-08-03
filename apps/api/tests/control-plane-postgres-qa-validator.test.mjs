import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertControlPlanePostgresQaCapabilities,
  assertLifecycleReceiptContainsNoCredentialMaterial,
  buildSyntheticApiKeyCreateInput,
  CONTROL_PLANE_API_KEY_CREATE_SQL,
  CONTROL_PLANE_REQUIRED_MIGRATIONS,
  summarizeApiKeyCreateResult,
  summarizeLifecycleReceipt,
  WEBHOOK_CUTOVER_SQL,
  WEBHOOK_DELIVERY_INSERT_SQL,
  webhookDestinationFingerprint,
} from "../scripts/validate-control-plane-postgres-qa.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function completeCapabilityRow(overrides = {}) {
  return {
    users: true,
    tenant_api_keys: true,
    api_key_receipts: true,
    webhook_endpoints: true,
    webhook_deliveries: true,
    webhook_audit: true,
    api_key_create_function: true,
    api_key_guard_trigger: true,
    api_key_receipt_trigger: true,
    webhook_version_insert_trigger: true,
    webhook_version_trigger: true,
    webhook_snapshot_trigger: true,
    webhook_identity_trigger: true,
    supplier_order_atomic_create_functions: true,
    offline_scan_history_index: true,
    supplier_manifest_atomic_import: true,
    applied_migrations: [...CONTROL_PLANE_REQUIRED_MIGRATIONS],
    receipt_forbidden_columns: [],
    ...overrides,
  };
}

function emptyControlPlaneCounts(overrides = {}) {
  return {
    api_key_count: 0,
    api_key_receipt_count: 0,
    webhook_endpoint_count: 0,
    webhook_delivery_count: 0,
    webhook_audit_count: 0,
    ...overrides,
  };
}

test("control-plane preflight requires 0077-0081 capabilities and an empty disposable target", async () => {
  const client = {
    calls: 0,
    async query() {
      this.calls += 1;
      return this.calls === 1
        ? { rows: [completeCapabilityRow()] }
        : { rows: [emptyControlPlaneCounts()] };
    },
  };
  const result = await assertControlPlanePostgresQaCapabilities(client);
  assert.deepEqual(result.appliedMigrations, [...CONTROL_PLANE_REQUIRED_MIGRATIONS]);
  assert.equal(result.businessRowCount, 0);
  assert.deepEqual(result.receiptForbiddenColumns, []);

  await assert.rejects(
    () => assertControlPlanePostgresQaCapabilities({
      async query() {
        return { rows: [completeCapabilityRow({ webhook_snapshot_trigger: false })] };
      },
    }),
    /control_plane_qa_0077_0081_capabilities_missing/,
  );

  await assert.rejects(
    () => assertControlPlanePostgresQaCapabilities({
      async query() {
        return { rows: [completeCapabilityRow({
          applied_migrations: [CONTROL_PLANE_REQUIRED_MIGRATIONS[0]],
        })] };
      },
    }),
    /control_plane_qa_0077_0081_migration_ledger_incomplete/,
  );

  await assert.rejects(
    () => assertControlPlanePostgresQaCapabilities({
      async query() {
        return { rows: [completeCapabilityRow({ receipt_forbidden_columns: ["key_hash"] })] };
      },
    }),
    /control_plane_qa_receipt_credential_columns_present:key_hash/,
  );

  const nonEmpty = {
    calls: 0,
    async query() {
      this.calls += 1;
      return this.calls === 1
        ? { rows: [completeCapabilityRow()] }
        : { rows: [emptyControlPlaneCounts({ api_key_count: 1, webhook_audit_count: 2 })] };
    },
  };
  await assert.rejects(
    () => assertControlPlanePostgresQaCapabilities(nonEmpty),
    /control_plane_qa_business_tables_not_empty:3/,
  );
});

test("synthetic API-key input hashes in memory and safe projections never expose credential material", () => {
  const syntheticCredential = "qa-only-this-is-not-a-real-api-key";
  const material = buildSyntheticApiKeyCreateInput({
    tenantId: "11111111-1111-4111-8111-111111111111",
    actorId: "22222222-2222-4222-8222-222222222222",
    runId: "0123456789abcdef",
    lane: "a",
    syntheticCredential,
  });
  assert.equal(
    material.keyHash,
    createHash("sha256").update(syntheticCredential, "utf8").digest("hex"),
  );
  assert.equal(material.input.max_active_keys, 1);
  assert.deepEqual(material.input.scopes, ["sdk:verify"]);
  assert.equal(JSON.stringify(material.input).includes(syntheticCredential), false);
  assert.equal("raw_secret" in material.input, false);

  const result = summarizeApiKeyCreateResult({
    outcome: "created",
    id: "33333333-3333-4333-8333-333333333333",
    status: "active",
    active_count: 1,
    receipt_id: 9,
    key_hash: material.keyHash,
    raw_secret: syntheticCredential,
  });
  assert.deepEqual(result, {
    outcome: "created",
    api_key_id: "33333333-3333-4333-8333-333333333333",
    status: "active",
    active_count: 1,
    receipt_id: "9",
  });
  assert.equal(JSON.stringify(result).includes(material.keyHash), false);
  assert.equal(JSON.stringify(result).includes(syntheticCredential), false);
});

test("lifecycle receipt guard accepts the canonical public state and rejects fields or values carrying keys", () => {
  const syntheticCredential = "qa-only-credential-value";
  const keyHash = createHash("sha256").update(syntheticCredential).digest("hex");
  const receipt = {
    id: "12",
    operation_id: "44444444-4444-4444-8444-444444444444",
    tenant_id: "11111111-1111-4111-8111-111111111111",
    api_key_id: "33333333-3333-4333-8333-333333333333",
    actor_id: "22222222-2222-4222-8222-222222222222",
    action: "create",
    previous_status: null,
    current_status: "active",
    changed_fields: ["name", "scopes", "status", "expires_at"],
    previous_state: null,
    current_state: {
      name: "QA control plane a",
      scopes: ["sdk:verify"],
      status: "active",
      expires_at: null,
    },
    request_fingerprint: `sha256:${"a".repeat(64)}`,
  };
  assert.equal(
    assertLifecycleReceiptContainsNoCredentialMaterial(receipt, [syntheticCredential, keyHash]),
    true,
  );
  assert.deepEqual(summarizeLifecycleReceipt(receipt), {
    receipt_id: "12",
    action: "create",
    current_status: "active",
    changed_fields: ["name", "scopes", "status", "expires_at"],
    request_fingerprint_present: true,
  });
  assert.throws(
    () => assertLifecycleReceiptContainsNoCredentialMaterial({ ...receipt, key_hash: keyHash }),
    /forbidden credential fields/,
  );
  assert.throws(
    () => assertLifecycleReceiptContainsNoCredentialMaterial({
      ...receipt,
      current_state: { ...receipt.current_state, note: syntheticCredential },
    }, [syntheticCredential]),
    /contains prohibited credential material/,
  );
});

test("webhook cutover SQL serializes update/insert and records only destination fingerprints", () => {
  assert.match(WEBHOOK_CUTOVER_SQL, /WITH locked AS MATERIALIZED/);
  assert.match(WEBHOOK_CUTOVER_SQL, /FOR UPDATE/);
  assert.match(WEBHOOK_CUTOVER_SQL, /status = 'dead_letter'/);
  assert.match(WEBHOOK_CUTOVER_SQL, /last_error = 'webhook_destination_changed'/);
  assert.match(WEBHOOK_CUTOVER_SQL, /'previous_destination_fingerprint', \$5::text/);
  assert.match(WEBHOOK_CUTOVER_SQL, /'destination_fingerprint', \$6::text/);
  const auditMetadata = WEBHOOK_CUTOVER_SQL.match(/jsonb_build_object\(([\s\S]*?)\)\s+FROM updated/)?.[1] || "";
  assert.doesNotMatch(auditMetadata, /\$3/);
  assert.match(WEBHOOK_DELIVERY_INSERT_SQL, /destination_version/);
  assert.match(WEBHOOK_DELIVERY_INSERT_SQL, /RETURNING[\s\S]*endpoint_url/);

  const oldUrl = "https://qa.example.invalid/webhooks/old";
  const fingerprint = webhookDestinationFingerprint(oldUrl);
  assert.match(fingerprint, /^sha256:[0-9a-f]{32}$/);
  assert.equal(fingerprint.includes(oldUrl), false);
});

test("validator syntax and static contract prove real concurrency, rollback and bounded claims", async () => {
  const scriptPath = path.join(apiRoot, "scripts", "validate-control-plane-postgres-qa.mjs");
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], {
    cwd: apiRoot,
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = await readFile(scriptPath, "utf8");
  assert.match(source, /assertSunAtomicPostgresQaTarget/);
  assert.match(source, /readSunAtomicPostgresQaConfig/);
  assert.match(source, /sanitizeSunAtomicQaFailure/);
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
  assert.match(CONTROL_PLANE_API_KEY_CREATE_SQL, /nexid_create_tenant_api_key_v1\(\$1::jsonb\)/);
  assert.match(source, /nexid_control_qa_quota_a_/);
  assert.match(source, /nexid_control_qa_quota_b_/);
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended\('tenant-api-key-quota:'/);
  assert.match(source, /waitForLockWaiters\(observer, pids, \{ advisoryOnly: true \}\)/);
  assert.match(source, /await client\.query\("BEGIN"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
  assert.match(source, /key_and_receipt_absent_after_rollback: true/);
  assert.match(source, /waitForLockWaiters\(observer, \[inserterPid\], \{ advisoryOnly: false \}\)/);
  assert.match(source, /caller_url_and_version_overridden/);
  assert.match(source, /raw_urls_absent: true/);
  assert.match(source, /physical_nfc_cryptographic_path_touched: false/);
  assert.match(source, /managed_kms_validated: false/);
  assert.match(source, /hsm_validated: false/);
  assert.match(source, /disposable_neon_branch_deletion_required_append_only_evidence_not_mutated/);
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE|DISABLE\s+TRIGGER|DELETE\s+FROM/i);

  const migration0077 = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    CONTROL_PLANE_REQUIRED_MIGRATIONS[0],
  ), "utf8");
  const migration0078 = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    CONTROL_PLANE_REQUIRED_MIGRATIONS[1],
  ), "utf8");
  const migration0079 = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    CONTROL_PLANE_REQUIRED_MIGRATIONS[2],
  ), "utf8");
  const migration0080 = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    CONTROL_PLANE_REQUIRED_MIGRATIONS[3],
  ), "utf8");
  const migration0081 = await readFile(path.join(
    apiRoot,
    "db",
    "migrations",
    CONTROL_PLANE_REQUIRED_MIGRATIONS[4],
  ), "utf8");
  assert.match(migration0077, /pg_advisory_xact_lock\(hashtextextended\('tenant-api-key-quota:'/);
  assert.match(migration0078, /CREATE TRIGGER trg_webhook_destination_version_insert/);
  assert.match(migration0078, /FOR SHARE/);
  assert.match(migration0078, /NEW\.endpoint_url := v_endpoint\.url/);
  assert.match(migration0078, /NEW\.destination_version := v_endpoint\.destination_version/);
  assert.match(migration0079, /CREATE OR REPLACE FUNCTION public\.nexid_create_supplier_order_v2\(p_input jsonb\)/);
  assert.match(migration0079, /pg_advisory_xact_lock/);
  assert.match(migration0079, /'managed_kms', false/);
  assert.match(migration0079, /'hsm_backed', false/);
  assert.match(migration0080, /idx_offline_scan_events_tenant_history[\s\S]*tenant_id,[\s\S]*received_at DESC,[\s\S]*id DESC/);
  assert.match(migration0081, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global/);
  assert.match(migration0081, /JOIN memberships membership/);
  assert.match(migration0081, /supplier_manifest_quantity_override_forbidden/);
  assert.match(migration0081, /REVOKE ALL ON FUNCTION public\.nexid_import_tag_manifest_v2\(jsonb\) FROM PUBLIC/);
});
