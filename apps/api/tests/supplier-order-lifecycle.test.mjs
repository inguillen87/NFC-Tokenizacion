import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildSupplierOpsErrorReport } from "../src/lib/supplier-ops-error-report.ts";
import {
  hasSupplierOrderLifecycleV1,
  SUPPLIER_ORDER_LIFECYCLE_MIGRATION,
  supplierOrderLifecycleError,
  transitionSupplierOrderLifecycleV1,
  validSupplierOrderLifecycleOperationKey,
} from "../src/lib/supplier-order-lifecycle.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function source(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

const validReceipt = {
  id: "22222222-2222-4222-8222-222222222222",
  supplier_order_id: "11111111-1111-4111-8111-111111111111",
  transition: "mark_sent",
  from_status: "pack_ready",
  to_status: "sent_to_supplier",
  pack_purpose: "production",
  event_hash: `sha256:${"a".repeat(64)}`,
  created_at: "2026-08-02T21:00:00.000Z",
  idempotent_replay: false,
  tenant_acceptance_claimed: false,
  physical_handover_verified: false,
  qa_override: false,
  activation_override: false,
};

test("supplier lifecycle helper requires safe idempotency and validates truthful readback", async () => {
  assert.equal(validSupplierOrderLifecycleOperationKey("supplier-lifecycle:abc123"), true);
  assert.equal(validSupplierOrderLifecycleOperationKey("short"), false);
  assert.equal(validSupplierOrderLifecycleOperationKey("supplier lifecycle with spaces"), false);

  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ receipt: validReceipt }];
  };
  const receipt = await transitionSupplierOrderLifecycleV1({
    supplierOrderId: validReceipt.supplier_order_id,
    transition: "mark_sent",
    operationKey: "supplier-lifecycle:abc123",
    recipientRef: "Factory QA desk",
    deliveryChannel: "secure_transfer",
    evidenceRef: "artifact://factory-pack/receipt-1",
    reason: "Pack entregado por el canal seguro acordado.",
    actorId: "33333333-3333-4333-8333-333333333333",
    authSessionId: "44444444-4444-4444-8444-444444444444",
  }, query);

  assert.equal(receipt.to_status, "sent_to_supplier");
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /nexid_transition_supplier_order_v1\(\?::jsonb\)/);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.recipient_ref, "Factory QA desk");
  assert.equal(payload.delivery_channel, "secure_transfer");
  assert.equal("actor_email" in payload, false);
  assert.equal("tenant_acceptance_claimed" in payload, false);

  await assert.rejects(
    transitionSupplierOrderLifecycleV1({
      supplierOrderId: validReceipt.supplier_order_id,
      transition: "mark_sent",
      operationKey: "supplier-lifecycle:abc124",
      recipientRef: "Factory QA desk",
      deliveryChannel: "secure_transfer",
      evidenceRef: "artifact://factory-pack/receipt-1",
      reason: "Pack entregado por el canal seguro acordado.",
      actorId: "33333333-3333-4333-8333-333333333333",
      authSessionId: "44444444-4444-4444-8444-444444444444",
    }, async () => [{ receipt: { ...validReceipt, physical_handover_verified: true } }]),
    /supplier_order_lifecycle_readback_invalid/,
  );
});

test("supplier lifecycle capability is rolling-safe and errors are bounded", async () => {
  const calls = [];
  assert.equal(await hasSupplierOrderLifecycleV1(async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ ready: true }];
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regclass\('public\.supplier_order_lifecycle_receipts'\)/);
  assert.match(calls[0].statement, /has_function_privilege/);

  assert.deepEqual(
    supplierOrderLifecycleError(new Error("supplier_order_handover_qa_gate_required")),
    { status: 409, reason: "supplier_order_handover_qa_gate_required" },
  );
  assert.deepEqual(
    supplierOrderLifecycleError(new Error("supplier_order_lifecycle_actor_scope_invalid")),
    { status: 403, reason: "supplier_order_lifecycle_forbidden" },
  );
  assert.deepEqual(
    supplierOrderLifecycleError(Object.assign(new Error("undefined function"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_order_lifecycle_migration_required",
      requiredMigration: SUPPLIER_ORDER_LIFECYCLE_MIGRATION,
    },
  );
});

test("0086 records custody transitions atomically without granting QA or physical acceptance", () => {
  const migration = source(`apps/api/db/migrations/${SUPPLIER_ORDER_LIFECYCLE_MIGRATION}`);
  const route = source("apps/api/src/app/admin/supplier-orders/[orderId]/lifecycle/route.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_order_lifecycle_receipts/);
  assert.match(migration, /BEFORE UPDATE OR DELETE[\s\S]*nexid_supplier_order_lifecycle_append_only_v1/);
  assert.match(migration, /auth_session\.role::text = 'super_admin'[\s\S]*membership\.role::text = 'super_admin'/);
  assert.match(migration, /auth_session\.mfa_verified IS TRUE/);
  assert.match(migration, /key_export_count = 1 AND sub_batch\.key_exported_at IS NOT NULL/);
  assert.match(migration, /v_all_manifest_imported[\s\S]*v_all_qa_passed/);
  assert.match(migration, /v_pack_purpose = 'production' AND NOT v_all_production_activated/);
  assert.match(migration, /v_pack_purpose = 'trial_integration' AND NOT v_all_trial_inactive/);
  assert.match(migration, /WHEN v_transition = 'mark_sent' THEN 'BLOCKED_PENDING_RECEIVING_QA'/);
  assert.match(migration, /'tenant_acceptance_claimed', false[\s\S]*'physical_handover_verified', false[\s\S]*'qa_override', false[\s\S]*'activation_override', false/);
  assert.match(migration, /INSERT INTO supplier_order_lifecycle_receipts[\s\S]*UPDATE supplier_orders[\s\S]*INSERT INTO evidence_events[\s\S]*INSERT INTO audit_logs/);
  assert.doesNotMatch(migration, /UPDATE\s+supplier_(?:qa|production_qa)/i);

  assert.match(route, /checkAdmin\(req, \["super_admin"\]\)/);
  assert.match(route, /rateClass: "proof_write"/);
  assert.match(route, /adminCriticalRateLimitIdentity\(req\)/);
  assert.match(route, /getAdminPrincipal\(req\)\.mfaVerified/);
  assert.match(route, /supplier_order_lifecycle_mfa_required/);
  assert.match(route, /readBoundedJsonBody[\s\S]*MAX_LIFECYCLE_BODY_BYTES/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /raw_nfc_keys_in_receipt:\s*false/);
  assert.doesNotMatch(route, /K_META_BATCH|K_FILE_BATCH/);
});

test("supplier manifest and QA error reports are safe downloadable CSV", () => {
  const report = buildSupplierOpsErrorReport({
    stage: "manifest",
    bid: "SYN/AR 2026",
    reason: "manifest_validation_failed",
    issues: [{ row: 4, code: "invalid_uid", field: "uid_hex", value: "=WEBSERVICE(\"https://evil.invalid\")" }],
  });
  assert.equal(report.schema_version, "nexid-supplier-ops-error-report/v1");
  assert.equal(report.filename, "nexid-manifest-errors-SYN-AR-2026.csv");
  assert.equal(report.row_count, 1);
  assert.match(report.csv, /'=WEBSERVICE/);
  assert.doesNotMatch(report.csv, /,=WEBSERVICE/);
});
