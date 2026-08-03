import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relativePath) {
  return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const migration = source("../db/migrations/20260802090000_0076_supplier_production_activation_v2.sql");
const migration75 = source("../db/migrations/20260801090000_0075_supplier_production_qa_acceptance.sql");
const migration71 = source("../db/migrations/20260729143000_0071_supplier_pack_purpose_governance.sql");
const activationHelper = source("../src/lib/supplier-production-activation.ts");
const tagActivationRoute = source("../src/app/admin/tags/activate/route.ts");
const activationRoutes = [
  source("../src/app/admin/batches/[bid]/activate-all/route.ts"),
  source("../src/app/admin/tags/activate/route.ts"),
  source("../src/app/admin/batches/[bid]/state/route.ts"),
];

test("0076 promotes the reviewed v2 candidate into the existing 0071 commercial boundary", () => {
  assert.match(migration75, /candidate checks are intentionally not wired into the v1/);
  assert.doesNotMatch(migration75, /CREATE OR REPLACE FUNCTION public\.nexid_assert_supplier_commercial_release_v1/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_assert_supplier_commercial_release_v1/);
  assert.match(migration, /PERFORM public\.nexid_assert_supplier_production_activation_v2\(v_batch\.id\)/);
  assert.match(migration71, /CREATE TRIGGER trg_supplier_tag_commercial_transition_guard/);
  assert.match(migration71, /CREATE TRIGGER trg_supplier_batch_commercial_transition_guard/);
  assert.match(migration71, /CREATE TRIGGER trg_supplier_sdk_pos_commercial_guard/);
  assert.match(migration71, /CREATE TRIGGER trg_supplier_sdk_claim_commercial_guard/);
  assert.match(migration71, /CREATE TRIGGER trg_supplier_consumer_ownership_commercial_guard/);
});

test("production activation requires one current tenant-approved plan for the exact lot", () => {
  assert.match(migration, /plan_decision\.decision_status = 'approved'/);
  assert.match(migration, /plan_decision\.approver_role = 'tenant_admin'/);
  assert.match(migration, /plan_decision\.decided_at <= now\(\)/);
  assert.match(migration, /newer_plan\.revision > plan\.revision/);
  assert.match(migration, /plan\.tenant_id = sub_batch\.tenant_id/);
  assert.match(migration, /plan\.supplier_order_id = sub_batch\.supplier_order_id/);
  assert.match(migration, /plan\.supplier_sub_batch_id = sub_batch\.id/);
  assert.match(migration, /plan\.batch_id = sub_batch\.batch_id/);
  assert.match(migration, /upper\(plan\.bid\) = upper\(sub_batch\.bid\)/);
  assert.match(migration, /plan\.lot_size = sub_batch\.expected_quantity/);
  assert.match(migration, /plan\.plan_binding->>'lot_size'/);
});

test("activation proves a consumed session and PASSED receipts on the exact scope", () => {
  assert.match(migration, /JOIN supplier_production_qa_decisions receipt/);
  assert.match(migration, /receipt\.session_id = session_row\.id/);
  assert.match(migration, /receipt\.schema_version = 'supplier-production-acceptance\/v2'/);
  assert.match(migration, /receipt\.status = 'passed'/);
  assert.match(migration, /receipt\.disposition = 'ACCEPT'/);
  assert.match(migration, /receipt\.decided_at >= session_row\.created_at/);
  assert.match(migration, /receipt\.decided_at <= session_row\.expires_at/);
  assert.match(migration, /qa_check\.id = receipt\.qa_check_id/);
  assert.match(migration, /qa_check\.status = 'passed'/);
  assert.match(migration, /qa_check\.acceptance_scope = 'production_lot'/);
  assert.match(migration, /qa_check\.evidence_json->>'production_session_id' = session_row\.id::text/);
  assert.match(migration, /sub_batch\.manifest_count = sub_batch\.expected_quantity/);
  assert.match(migration, /count\(\*\)::integer FROM tags lot_tag WHERE lot_tag\.batch_id = batch\.id/);
});

test("atomic production writer owns tag state, projections and audit evidence", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_activate_supplier_tags_v2/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /FOR SHARE OF auth_session, actor, membership/);
  const updateIndex = migration.indexOf("UPDATE tags tag");
  const subBatchIndex = migration.indexOf("UPDATE supplier_sub_batches sub_batch", updateIndex);
  const batchIndex = migration.indexOf("UPDATE batches batch", subBatchIndex);
  const evidenceIndex = migration.indexOf("INSERT INTO evidence_events", batchIndex);
  const auditIndex = migration.indexOf("INSERT INTO audit_logs", evidenceIndex);
  assert.ok(updateIndex > 0 && subBatchIndex > updateIndex && batchIndex > subBatchIndex);
  assert.ok(evidenceIndex > batchIndex && auditIndex > evidenceIndex);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_activate_supplier_tags_v2\(jsonb\) FROM PUBLIC/);
  assert.doesNotMatch(migration, /override/i);
});

test("production activation is exactly-once for each tenant operation key", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_production_activation_receipts/);
  assert.match(migration, /operation_key text NOT NULL CHECK \(operation_key ~ '\^\[A-Za-z0-9\]/);
  assert.match(migration, /UNIQUE \(tenant_id, operation_key\)/);
  assert.match(migration, /request_fingerprint text NOT NULL CHECK/);
  assert.match(migration, /request_binding jsonb NOT NULL/);
  assert.match(migration, /trg_supplier_production_activation_receipts_append_only/);
  assert.match(migration, /supplier_production_activation_history_is_append_only/);

  const actorIndex = migration.indexOf("supplier_production_activation_actor_scope_invalid");
  const operationLockIndex = migration.indexOf("supplier-production-activation-operation", actorIndex);
  const replayLookupIndex = migration.indexOf("FROM supplier_production_activation_receipts activation", operationLockIndex);
  const acceptanceIndex = migration.indexOf("nexid_supplier_production_activation_receipt_v2(v_batch_id)", replayLookupIndex);
  const mutationIndex = migration.indexOf("UPDATE tags tag", acceptanceIndex);
  const receiptInsertIndex = migration.indexOf("INSERT INTO supplier_production_activation_receipts", mutationIndex);
  assert.ok(actorIndex > 0 && operationLockIndex > actorIndex);
  assert.ok(replayLookupIndex > operationLockIndex && acceptanceIndex > replayLookupIndex);
  assert.ok(mutationIndex > acceptanceIndex && receiptInsertIndex > mutationIndex);

  assert.match(migration, /'tenant_id', lower\(v_tenant_id::text\)/);
  assert.match(migration, /'supplier_order_id', lower\(v_supplier_order_id::text\)/);
  assert.match(migration, /'supplier_sub_batch_id', lower\(v_supplier_sub_batch_id::text\)/);
  assert.match(migration, /'batch_id', lower\(v_batch_id::text\)/);
  assert.match(migration, /'bid', v_bid/);
  assert.match(migration, /'lot_size', v_lot_size/);
  assert.match(migration, /'actor_id', lower\(v_actor_id::text\)/);
  assert.match(migration, /'selection_mode', v_selection_mode/);
  assert.match(migration, /digest\(v_request_binding::text, 'sha256'\)/);
  assert.match(migration, /supplier_production_activation_idempotency_conflict/);
  assert.match(migration, /v_existing\.activated_uids/);
  assert.match(migration, /v_existing\.evidence_event_hash/);
  assert.match(migration, /true;\s+RETURN;[\s\S]+false;\s+END;/);
});

test("explicit UID activation is all-or-nothing and never silently deduplicates", () => {
  const duplicateIndex = migration.indexOf("supplier_production_activation_uids_duplicate");
  const targetValidationIndex = migration.indexOf("supplier_production_activation_uids_not_activatable", duplicateIndex);
  const mutationIndex = migration.indexOf("UPDATE tags tag", targetValidationIndex);
  assert.ok(duplicateIndex > 0 && targetValidationIndex > duplicateIndex && mutationIndex > targetValidationIndex);
  assert.match(migration, /GROUP BY normalized_uid\.uid\s+HAVING count\(\*\) > 1/);
  assert.match(migration, /tag\.batch_id = v_batch_id\s+AND tag\.status::text = 'inactive'\s+AND upper\(tag\.uid_hex\) = ANY\(v_uids\)/);
  assert.match(migration, /v_selection_mode = 'uids' AND v_activated_count <> v_requested_count/);
  assert.doesNotMatch(activationHelper, /new Set\(input\.selection\.uids/);
  assert.match(tagActivationRoute, /\? \{ mode: "uids" as const, uids \}/);
});

test("admin activation routes load the authoritative receipt and production routes use the v2 writer", () => {
  assert.match(activationHelper, /nexid_supplier_production_activation_receipt_v2/);
  assert.match(activationHelper, /nexid_activate_supplier_tags_v2/);
  for (const route of activationRoutes) {
    assert.match(route, /loadSupplierProductionActivationReceiptV2/);
    assert.match(route, /productionAcceptanceV2/);
    assert.match(route, /supplierProductionActivationOperationKey\(req\)/);
    assert.match(route, /supplier_production_activation_idempotency_key_required/);
    assert.match(route, /operationKey,/);
    assert.doesNotMatch(route, /randomUUID|crypto\.randomUUID|Date\.now\(\).*operation/i);
    assert.doesNotMatch(route, /productionAcceptanceV2: null/);
  }
  assert.match(activationRoutes[0], /activateSupplierProductionTagsV2/);
  assert.match(activationRoutes[1], /activateSupplierProductionTagsV2/);
  assert.match(activationRoutes[2], /activateSupplierProductionTagsV2/);
  assert.match(activationRoutes[2], /selection: \{ mode: "state_only" \}/);
  assert.match(activationHelper, /activationReceiptId/);
  assert.match(activationHelper, /idempotentReplay/);
});

test("activation governance preserves the physical NFC path and makes no KMS or HSM claim", () => {
  assert.match(migration, /does not modify NFC keys, SUN\/SDM verification, counters, CMAC/);
  assert.doesNotMatch(migration, /hsm[_ -]?backed\s*[:=]\s*true/i);
  assert.doesNotMatch(migration, /managed[_ -]?kms\s*[:=]\s*true/i);
  assert.doesNotMatch(activationHelper, /K_META|K_FILE|decrypt|encrypt|CMAC|SDM/);
});
