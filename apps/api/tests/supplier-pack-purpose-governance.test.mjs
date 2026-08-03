import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../db/migrations/20260729143000_0071_supplier_pack_purpose_governance.sql", import.meta.url),
  "utf8",
);
const atomicCreateMigration = await readFile(
  new URL("../db/migrations/20260802150000_0079_supplier_order_atomic_create.sql", import.meta.url),
  "utf8",
);
const orderRoute = await readFile(
  new URL("../src/app/admin/supplier-orders/route.ts", import.meta.url),
  "utf8",
);
const qaRoute = await readFile(
  new URL("../src/app/admin/supplier-orders/[orderId]/qa/route.ts", import.meta.url),
  "utf8",
);
const activationRoutes = await Promise.all([
  "../src/app/admin/batches/[bid]/activate-all/route.ts",
  "../src/app/admin/tags/activate/route.ts",
  "../src/app/admin/batches/[bid]/state/route.ts",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

test("existing supplier orders fail closed as legacy without heuristic inference", () => {
  assert.match(migration, /UPDATE supplier_orders\s+SET pack_purpose = 'legacy_unclassified'\s+WHERE pack_purpose IS NULL/);
  assert.match(migration, /pack_purpose IN \('legacy_unclassified', 'trial_integration', 'production'\)/);
  assert.match(migration, /supplier_orders_pack_purpose_lock_check/);
  assert.doesNotMatch(migration, /SET pack_purpose = 'trial_integration'[\s\S]{0,180}WHERE/);
  assert.doesNotMatch(migration, /SET pack_purpose = 'production'[\s\S]{0,180}WHERE/);
});

test("new orders and sub-batches require one immutable explicit purpose", () => {
  assert.match(orderRoute, /normalizeSupplierPackPurpose\(body\.pack_purpose \?\? body\.packPurpose\)/);
  assert.match(orderRoute, /reason: "supplier_pack_purpose_required"/);
  assert.match(orderRoute, /hasSupplierOrderCreateV2/);
  assert.match(orderRoute, /createSupplierOrderV2/);
  assert.match(atomicCreateMigration, /chip_model, carrier_profile_code, pack_purpose,/);
  assert.match(atomicCreateMigration, /expected_quantity, pack_purpose, status, metadata_json/);
  assert.match(migration, /supplier_pack_purpose_is_immutable/);
  assert.match(migration, /supplier_sub_batch_commercial_scope_is_immutable/);
  assert.match(migration, /supplier_pack_purpose_classified_scope_is_frozen/);
  assert.match(migration, /supplier_pack_purpose_legacy_scope_is_frozen/);
  assert.match(migration, /BEFORE INSERT OR UPDATE ON supplier_sub_batches/);
});

test("legacy-to-trial classification is exact, append-only and non-sellable", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decisions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decision_items/);
  assert.match(migration, /CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL/);
  assert.match(migration, /supplier_pack_purpose_items_duplicate/);
  assert.match(migration, /supplier_pack_purpose_scope_enumeration_mismatch/);
  assert.match(migration, /supplier_pack_purpose_qa_receipt_mismatch/);
  assert.match(migration, /scope_item_count/);
  assert.match(migration, /'commercial_disposition', 'NON_SELLABLE'/);
  assert.match(migration, /'production_acceptance', false/);
  assert.match(migration, /'physical_ceremony_verified', false/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_pack_purpose_decisions/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_pack_purpose_decision_items/);
});

test("sub-batch membership serializes with legacy classification", () => {
  assert.match(
    migration,
    /nexid_supplier_pack_purpose_base_immutable_v1[\s\S]*pg_advisory_xact_lock\(hashtextextended\([\s\S]*supplier-pack-purpose[\s\S]*NEW\.supplier_order_id::text/,
  );
  assert.match(
    migration,
    /nexid_classify_legacy_supplier_order_trial_v1[\s\S]*pg_advisory_xact_lock\(hashtextextended\('supplier-pack-purpose' \|\| chr\(31\) \|\| v_supplier_order_id::text/,
  );
  assert.doesNotMatch(migration, /chr\(0\)/);
});

test("idempotent purpose receipts revalidate current actor scope", () => {
  assert.match(
    migration,
    /nexid_classify_legacy_supplier_order_trial_v1[\s\S]*supplier_pack_purpose_actor_scope_invalid[\s\S]*WHERE decision\.tenant_id = v_tenant_id/,
  );
  assert.match(
    migration,
    /JOIN memberships membership[\s\S]*FOR SHARE OF actor, membership[\s\S]*supplier_pack_purpose_actor_scope_invalid/,
  );
});

test("fixed SUN QA never becomes production acceptance while reviewed keyless QA remains separately gated", () => {
  assert.match(migration, /WHEN v_effective_purpose = 'trial_integration' THEN 'trial_integration'/);
  assert.match(migration, /MESSAGE = 'supplier_qa_pack_purpose_unclassified'/);
  assert.match(migration, /MESSAGE = 'supplier_qa_production_acceptance_v2_required'/);
  assert.match(qaRoute, /effectivePackPurpose === "legacy_unclassified"/);
  assert.match(qaRoute, /passed && effectivePackPurpose === "production" && requiresSecureSun/);
  assert.match(qaRoute, /reason: "supplier_qa_production_acceptance_v2_required"/);
  assert.match(qaRoute, /commercial_disposition: "NON_SELLABLE"/);
  assert.match(qaRoute, /activation_allowed: false/);
  assert.match(qaRoute, /effectivePackPurpose === "production" && passed[\s\S]*"BLOCKED_PENDING_ACTIVATION"/);
  assert.match(qaRoute, /effectivePackPurpose === "production"[\s\S]*"production_keyless_qa_passed_pending_activation"/);
  assert.match(qaRoute, /supplier_keyless_production_qa_plan_or_physical_evidence_required/);
});

test("QA acceptance and projection bind the exact tenant, order, sub-batch, batch and BID", () => {
  assert.match(migration, /sub_batch\.id = NEW\.supplier_sub_batch_id[\s\S]*sub_batch\.supplier_order_id = NEW\.supplier_order_id[\s\S]*sub_batch\.tenant_id = NEW\.tenant_id[\s\S]*sub_batch\.batch_id = NEW\.batch_id[\s\S]*upper\(sub_batch\.bid\) = upper\(NEW\.bid\)/);
  assert.match(migration, /batch\.supplier_order_id = sub_batch\.supplier_order_id[\s\S]*batch\.supplier_sub_batch_id = sub_batch\.id/);
  assert.match(migration, /qa_check\.supplier_sub_batch_id = NEW\.id[\s\S]*qa_check\.tenant_id = NEW\.tenant_id[\s\S]*qa_check\.supplier_order_id = NEW\.supplier_order_id[\s\S]*qa_check\.batch_id = NEW\.batch_id[\s\S]*upper\(qa_check\.bid\) = upper\(NEW\.bid\)/);
  assert.match(migration, /sub_batch\.batch_id = NEW\.id[\s\S]*sub_batch\.tenant_id = NEW\.tenant_id[\s\S]*sub_batch\.supplier_order_id = NEW\.supplier_order_id[\s\S]*sub_batch\.id = NEW\.supplier_sub_batch_id[\s\S]*upper\(sub_batch\.bid\) = upper\(NEW\.bid\)/);
});

test("legacy classification requires reciprocal batch scope and QA state-receipt equivalence", () => {
  assert.match(migration, /batch\.supplier_order_id = sub_batch\.supplier_order_id/);
  assert.match(migration, /batch\.supplier_sub_batch_id = sub_batch\.id/);
  assert.match(migration, /sub_batch\.pack_purpose = 'legacy_unclassified'/);
  assert.match(migration, /lower\(COALESCE\(sub_batch\.qa_status, ''\)\) = 'passed'[\s\S]*IS DISTINCT FROM \(passed_receipt\.id IS NOT NULL\)/);
  assert.match(migration, /lower\(COALESCE\(batch\.qa_status, ''\)\) = 'passed'[\s\S]*IS DISTINCT FROM \(passed_receipt\.id IS NOT NULL\)/);
});

test("classification idempotency fingerprints immutable intent and replays frozen scope", () => {
  const intentFingerprint = migration.match(/v_request_fingerprint :=[\s\S]*?\)::text, 'sha256'\), 'hex'\);/)?.[0] || "";
  assert.match(intentFingerprint, /supplier-pack-purpose-classification-intent\/v1/);
  assert.doesNotMatch(intentFingerprint, /'items'/);
  assert.match(migration, /scope_item_count integer NOT NULL CHECK \(scope_item_count BETWEEN 1 AND 52\)/);
  assert.match(migration, /frozen_item\.item_digest IS DISTINCT FROM 'sha256:'/);
  assert.match(migration, /MESSAGE = 'supplier_pack_purpose_replay_receipt_invalid'/);
  const replayScopeCheck = migration.match(/IF jsonb_array_length\(v_normalized_items\)[\s\S]*?MESSAGE = 'supplier_pack_purpose_idempotency_conflict';\s*END IF;/)?.[0] || "";
  assert.match(replayScopeCheck, /frozen_item\.supplier_sub_batch_id/);
  assert.doesNotMatch(replayScopeCheck, /qa_check_id/);
});

test("commercial release resolver detects forward, reverse and BID-linked supplier scope", () => {
  assert.match(migration, /sub_batch\.batch_id = v_batch\.id/);
  assert.match(migration, /sub_batch\.id = v_batch\.supplier_sub_batch_id/);
  assert.match(migration, /sub_batch\.tenant_id = v_batch\.tenant_id AND upper\(sub_batch\.bid\) = upper\(v_batch\.bid\)/);
  assert.match(migration, /v_sub_batch_count <> 1/);
  assert.match(migration, /MESSAGE = 'supplier_commercial_scope_invalid'/);
  assert.match(migration, /MESSAGE = 'supplier_trial_integration_non_sellable'/);
  assert.match(migration, /MESSAGE = 'supplier_production_acceptance_v2_required'/);
});

test("activation, POS, SDK claim and consumer ownership sinks share the DB guard", () => {
  assert.match(migration, /CREATE TRIGGER trg_supplier_batch_commercial_transition_guard/);
  assert.match(migration, /CREATE TRIGGER trg_supplier_tag_commercial_transition_guard/);
  assert.match(migration, /CREATE TRIGGER trg_supplier_sdk_pos_commercial_guard/);
  assert.match(migration, /CREATE TRIGGER trg_supplier_sdk_claim_commercial_guard/);
  assert.match(migration, /CREATE TRIGGER trg_supplier_consumer_ownership_commercial_guard/);
  assert.match(migration, /sdk_pos_commercial_identity_check/);
  assert.match(migration, /sdk_claim_commercial_identity_check/);
  assert.match(migration, /consumer_ownership_claimed_tag_check/);
  assert.match(migration, /consumer_ownership_event_scope_invalid/);
  assert.match(migration, /PERFORM public\.nexid_assert_supplier_commercial_release_v1\(NEW\.batch_id\)/);
});

test("every app activation route resolves purpose through tenant, order, reverse batch and BID scope", () => {
  for (const source of activationRoutes) {
    assert.match(source, /resolveSupplierActivationScope/);
    assert.match(source, /supplier_pack_purpose_decisions/);
    assert.match(source, /COALESCE\(purpose_decision\.to_purpose, supplier_order\.pack_purpose\) AS effective_pack_purpose/);
    assert.match(source, /sub_batch\.batch_id = \$\{batch\.id\}/);
    assert.match(source, /sub_batch\.id = \$\{batch\.supplier_sub_batch_id\}/);
    assert.match(source, /sub_batch\.tenant_id = \$\{batch\.tenant_id\} AND upper\(sub_batch\.bid\) = upper\(\$\{bid\}\)/);
    assert.match(source, /loadSupplierProductionActivationReceiptV2/);
    assert.match(source, /productionAcceptanceV2/);
    assert.doesNotMatch(source, /productionAcceptanceV2: null/);
    assert.match(source, /supplierActivationGateMessage/);
  }
});

test("governance preserves NFC crypto truth and makes no HSM claim", () => {
  assert.match(migration, /does not change K_META\/K_FILE, SUN\/SDM decoding/);
  assert.doesNotMatch(migration, /hsm_backed\s*[:=]\s*true/i);
  assert.doesNotMatch(migration, /managed_kms\s*[:=]\s*true/i);
});
