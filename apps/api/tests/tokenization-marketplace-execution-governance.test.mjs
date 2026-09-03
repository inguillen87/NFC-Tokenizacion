import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");
const [bridge, migration, dbRuntime, preflight, dryRun, target, runner] = await Promise.all([
  read("../db/migrations/20260726120000_0058_marketplace_runtime_baseline.sql"),
  read("../db/migrations/20260729160000_0072_tokenization_marketplace_execution_governance.sql"),
  read("../src/lib/db.ts"),
  read("../scripts/db-enterprise-release-preflight.mjs"),
  read("../scripts/db-enterprise-release-dry-run.mjs"),
  read("../scripts/db-enterprise-release-target.mjs"),
  read("../scripts/db-apply.mjs"),
]);

test("historical marketplace bridge owns its durable baseline and is ordered before 0059", () => {
  assert.match(bridge, /ADD COLUMN IF NOT EXISTS seller_consumer_id uuid/);
  assert.match(bridge, /ADD COLUMN IF NOT EXISTS resale_uid_hex text/);
  assert.match(bridge, /db-apply\.mjs --only 20260726120000_0058_marketplace_runtime_baseline\.sql/);
  assert.match(bridge, /CREATE TABLE IF NOT EXISTS consumer_product_experiences/);
  assert.match(bridge, /CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_product_experiences_ownership/);
  assert.doesNotMatch(bridge, /UPDATE marketplace|DROP COLUMN|ALTER COLUMN/);
  for (const surface of [dbRuntime, preflight]) {
    assert.ok(
      surface.indexOf("20260726103000_0058_webhook_signature_v2.sql")
        < surface.indexOf("20260726120000_0058_marketplace_runtime_baseline.sql"),
    );
    assert.ok(
      surface.indexOf("20260726120000_0058_marketplace_runtime_baseline.sql")
        < surface.indexOf("20260726135000_0059_marketplace_claim_truth_cleanup.sql"),
    );
  }
  assert.match(dryRun, /REQUIRED_APPLIED[\s\S]*20260726120000_0058_marketplace_runtime_baseline\.sql/);
  assert.match(preflight, /historical_gap_remediation[\s\S]*--only 20260726120000_0058_marketplace_runtime_baseline\.sql/);
});

test("0072 uses partition-safe event identities and only NOT VALID expand constraints", () => {
  assert.match(migration, /source_event_id bigint/);
  assert.match(migration, /source_event_created_at timestamptz/);
  assert.match(migration, /FOREIGN KEY \(source_event_id, source_event_created_at\)[\s\S]*REFERENCES events\(id, created_at\)[\s\S]*NOT VALID/);
  assert.match(migration, /FOREIGN KEY \(source_tap_event_id, source_tap_event_created_at\)[\s\S]*REFERENCES events\(id, created_at\)[\s\S]*NOT VALID/);
  assert.doesNotMatch(migration, /FOREIGN KEY \(source_event_id\)\s+REFERENCES events\(id\)/);
  assert.doesNotMatch(migration, /VALIDATE CONSTRAINT|DROP COLUMN|ALTER COLUMN .* SET NOT NULL/);
});

test("execution class separates simulation, testnet trial and live commercial execution", () => {
  assert.match(migration, /'legacy_unclassified', 'simulation', 'testnet_trial', 'live_chain'/);
  assert.match(migration, /'polygon-amoy', 'ethereum-sepolia', 'base-sepolia'/);
  assert.match(migration, /'polygon', 'ethereum-mainnet', 'base-mainnet'/);
  assert.match(migration, /tokenization_simulation_live_claim_forbidden/);
  assert.match(migration, /status <> 'anchored'[\s\S]*tx_hash IS NULL AND token_id IS NULL AND anchor_hash IS NULL/);
  assert.match(migration, /tokenization_testnet_trial_scope_required/);
  assert.match(migration, /v_commercial_disposition := 'NON_SELLABLE'/);
  assert.match(migration, /PERFORM public\.nexid_assert_supplier_commercial_release_v1\(v_request\.batch_id\)/);
  assert.match(migration, /SET execution_class = 'testnet_trial'[\s\S]*request\.tag_id IS NOT NULL[\s\S]*event\.created_at = request\.source_event_created_at[\s\S]*event\.cmac_ok IS TRUE[\s\S]*event\.allowlisted IS TRUE[\s\S]*upper\(COALESCE\(event\.result, ''\)\) = 'VALID'/);
  assert.match(migration, /SET execution_class = 'testnet_trial'[\s\S]*request\.status <> 'anchored'[\s\S]*meta->>'evidence_verified'[\s\S]*request\.tx_hash[\s\S]*request\.token_id/);
  assert.match(migration, /tokenization_simulation_anchor_reconciliation_required/);
  assert.match(migration, /SET status = 'reconciling'[\s\S]*last_error = 'tokenization_historical_anchor_scope_unverified'[\s\S]*WHERE request\.execution_class = 'legacy_unclassified'[\s\S]*request\.status = 'anchored'/);
  assert.match(migration, /upper\(COALESCE\(v_event\.result, ''\)\) <> 'VALID'/);
  assert.match(migration, /tag\.status::text = 'active'[\s\S]*tag\.lifecycle_state IS NULL OR tag\.lifecycle_state = 'active'[\s\S]*batch\.status::text IN \('active', 'active_in_market'\)/);
});

test("tokenization execution is exact, deduplicated and conservatively leased", () => {
  assert.match(migration, /uq_tokenization_request_asset_execution/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tokenization_request_asset_execution[\s\S]*ON tokenization_requests \(tenant_id, tag_id, execution_class, lower\(network\)\)[\s\S]*WHERE tenant_id IS NOT NULL[\s\S]*tag_id IS NOT NULL[\s\S]*execution_class IN \('testnet_trial', 'live_chain'\)/);
  assert.match(migration, /PARTITION BY tenant_id, tag_id, execution_class, lower\(network\)/);
  assert.match(migration, /tokenization_duplicate_asset_requires_reconciliation/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_prepare_tokenization_execution_v1\([\s\S]*p_tenant_id uuid,[\s\S]*p_request_id uuid,[\s\S]*p_lease_id uuid,[\s\S]*p_processor text,[\s\S]*p_lease_seconds integer DEFAULT 120/);
  assert.match(migration, /FOR UPDATE OF request/);
  assert.match(migration, /AND request\.status = 'pending'[\s\S]*RETURNING request\.\* INTO v_request/);
  assert.match(migration, /'acquired'::text/);
  assert.match(migration, /'lease_replay'::text/);
  assert.match(migration, /'busy'::text/);
  assert.match(migration, /'reconcile_required'::text/);
  assert.match(migration, /'already_final'::text/);
  assert.match(migration, /'simulation_only'::text/);
  assert.match(migration, /expired_lease_id/);
  assert.match(migration, /automatic_retry_blocked/);
  assert.match(migration, /OLD\.status = 'processing'[\s\S]*NEW\.status NOT IN \('processing', 'anchored', 'reconciling'\)[\s\S]*tokenization_processing_transition_invalid/);
  assert.match(migration, /OLD\.lease_id IS NULL OR NEW\.lease_id IS DISTINCT FROM OLD\.lease_id[\s\S]*tokenization_processing_lease_changed/);
  assert.match(migration, /OLD\.status = 'reconciling'[\s\S]*NEW\.status NOT IN \('reconciling', 'anchored'\)[\s\S]*tokenization_reconciliation_retry_forbidden/);
  assert.match(migration, /OLD\.status = 'reconciling'[\s\S]*OLD\.lease_id IS NULL OR NEW\.lease_id IS DISTINCT FROM OLD\.lease_id[\s\S]*tokenization_reconciliation_lease_required/);
  assert.match(migration, /OLD\.status IN \('anchored', 'simulated'\)[\s\S]*NEW\.meta IS DISTINCT FROM OLD\.meta[\s\S]*NEW\.lease_expires_at IS DISTINCT FROM OLD\.lease_expires_at[\s\S]*tokenization_terminal_state_immutable/);
  assert.match(migration, /OLD\.tx_hash IS NOT NULL AND NEW\.tx_hash IS DISTINCT FROM OLD\.tx_hash[\s\S]*OLD\.external_ref IS NOT NULL AND NEW\.external_ref IS DISTINCT FROM OLD\.external_ref[\s\S]*OLD\.lease_expires_at IS NOT NULL AND NEW\.lease_expires_at IS DISTINCT FROM OLD\.lease_expires_at[\s\S]*dispatch_started_at[\s\S]*tokenization_execution_evidence_immutable/);
  assert.match(migration, /tokenization_execution_status_check[\s\S]*'pending', 'processing', 'reconciling', 'anchored', 'failed', 'simulated', 'blocked'[\s\S]*NOT VALID/);
  assert.match(migration, /NEW\.status = 'anchored'[\s\S]*OLD\.status NOT IN \('processing', 'reconciling', 'anchored'\)[\s\S]*tokenization_anchor_transition_invalid/);
  assert.match(migration, /NEW\.status = 'anchored'[\s\S]*meta->>'evidence_verified'[\s\S]*NEW\.tx_hash[\s\S]*NEW\.token_id[\s\S]*tokenization_anchor_evidence_required/);
  assert.match(migration, /tokenization_asset_not_execution_eligible/);
  assert.match(migration, /UPDATE tokenization_requests request[\s\S]*tokenization_historical_anchor_scope_unverified[\s\S]*CREATE OR REPLACE FUNCTION public\.nexid_tokenization_execution_scope_guard_v1/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_prepare_tokenization_execution_v1\(uuid, uuid, uuid, text, integer\) FROM PUBLIC/);

  const prepare = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_prepare_tokenization_execution_v1"));
  const simulationReturn = prepare.indexOf("IF v_request.execution_class = 'simulation' OR v_request.status = 'simulated' THEN");
  const historicalScope = prepare.indexOf("This first lookup proves the immutable historical identity and SUN verdict");
  const networkClassification = prepare.indexOf("IF v_request.execution_class = 'testnet_trial' THEN", historicalScope);
  const anchoredReturn = prepare.indexOf("IF v_request.status = 'anchored' THEN");
  const revokedProjection = prepare.indexOf("REVOKED_HISTORICAL_PROOF", anchoredReturn);
  const pendingEligibility = prepare.indexOf("IF NOT v_current_asset_eligible THEN", revokedProjection + 1);
  const pendingSupplierRevalidation = prepare.indexOf(
    "PERFORM public.nexid_assert_supplier_commercial_release_v1(v_request.batch_id)",
    pendingEligibility,
  );
  assert.ok(
    simulationReturn >= 0
      && historicalScope > simulationReturn
      && networkClassification > historicalScope
      && anchoredReturn > networkClassification
      && revokedProjection > anchoredReturn
      && pendingEligibility > revokedProjection
      && pendingSupplierRevalidation > pendingEligibility,
  );
  assert.match(prepare, /IF v_request\.status = 'anchored' THEN[\s\S]*REVOKED_HISTORICAL_PROOF[\s\S]*'already_final'::text[\s\S]*v_commercial_disposition, false/);
});

test("marketplace attribution stays optional but complete tuples and active P2P are exact", () => {
  assert.match(migration, /marketplace_request_source_tuple_check/);
  assert.match(migration, /source_tap_event_id IS NULL AND source_tap_event_created_at IS NULL[\s\S]*source_batch_id IS NULL AND source_tag_id IS NULL/);
  assert.match(migration, /marketplace_request_source_scope_invalid/);
  assert.match(migration, /CREATE TRIGGER trg_nexid_marketplace_request_asset_scope_v1/);
  assert.match(migration, /CREATE TRIGGER trg_nexid_marketplace_offer_asset_scope_v1/);
  assert.match(migration, /ownership\.id = NEW\.ownership_id[\s\S]*ownership\.tenant_id = NEW\.tenant_id[\s\S]*ownership\.consumer_id = NEW\.seller_consumer_id[\s\S]*ownership\.status = 'claimed'/);
  assert.match(migration, /marketplace_p2p_ownership_scope_invalid/);
  assert.match(migration, /inactive_reason', 'ownership_scope_not_currently_eligible'/);
  assert.match(migration, /WHERE offer\.type = 'p2p_resale'[\s\S]*offer\.status = 'active'[\s\S]*AND NOT EXISTS/);
  assert.match(migration, /event\.cmac_ok IS TRUE[\s\S]*event\.allowlisted IS TRUE[\s\S]*upper\(COALESCE\(event\.result, ''\)\) = 'VALID'/);
  assert.match(migration, /PERFORM public\.nexid_assert_supplier_commercial_release_v1\(v_batch_id\)/);
  assert.match(migration, /CREATE TRIGGER trg_nexid_marketplace_ownership_offer_invalidation_v1[\s\S]*AFTER UPDATE OF status, tag_id, batch_id, consumer_id, tenant_id, uid_hex, event_id/);
  assert.match(migration, /ownership_no_longer_claimed/);
  assert.match(migration, /CREATE TRIGGER trg_nexid_marketplace_tag_offer_invalidation_v1[\s\S]*AFTER UPDATE OF status, lifecycle_state[\s\S]*ON tags/);
  assert.match(migration, /CREATE TRIGGER trg_nexid_marketplace_batch_offer_invalidation_v1[\s\S]*AFTER UPDATE OF status[\s\S]*ON batches/);
  assert.match(migration, /tag_no_longer_marketplace_eligible/);
  assert.match(migration, /batch_no_longer_marketplace_eligible/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_marketplace_ownership_offer_invalidation_v1\(\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_marketplace_tag_offer_invalidation_v1\(\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_marketplace_batch_offer_invalidation_v1\(\) FROM PUBLIC/);
});

test("release tooling advances through 0100 and unauthorized empty bootstrap fails before DDL", () => {
  for (const surface of [dbRuntime, preflight, dryRun]) {
    assert.match(surface, /20260730110000_0073_supplier_qa_verification_context_v2\.sql/);
  }
  for (const surface of [dbRuntime, preflight, dryRun]) {
    assert.match(surface, /20260730150000_0074_supplier_key_rotation_atomic\.sql/);
  }
  for (const surface of [dbRuntime, preflight, dryRun]) {
    assert.match(surface, /20260801090000_0075_supplier_production_qa_acceptance\.sql/);
  }
  for (const surface of [dbRuntime, preflight, dryRun]) {
    assert.match(surface, /20260802090000_0076_supplier_production_activation_v2\.sql/);
    assert.match(surface, /20260802113000_0077_tenant_api_key_lifecycle\.sql/);
    assert.match(surface, /20260802130000_0078_webhook_destination_cutover\.sql/);
    assert.match(surface, /20260802150000_0079_supplier_order_atomic_create\.sql/);
    assert.match(surface, /20260802153000_0080_offline_scan_history_index\.sql/);
    assert.match(surface, /20260802160000_0081_supplier_manifest_atomic_import\.sql/);
    assert.match(surface, /20260802170000_0082_consumer_session_revocation\.sql/);
    assert.match(surface, /20260802180000_0083_sdk_event_webhook_atomic_outbox\.sql/);
    assert.match(surface, /20260802190000_0084_tenant_vault_audited_download\.sql/);
    assert.match(surface, /20260802200000_0085_supplier_non_sun_qa_evidence\.sql/);
    assert.match(surface, /20260802210000_0086_supplier_order_lifecycle\.sql/);
    assert.match(surface, /20260802220000_0087_packaging_lab_foundation\.sql/);
    assert.match(surface, /20260802230000_0088_enterprise_event_profile\.sql/);
    assert.match(surface, /20260802240000_0089_sun_carrier_trust_state\.sql/);
    assert.match(surface, /20260802250000_0090_supplier_carrier_key_scope\.sql/);
    assert.match(surface, /20260802260000_0091_supplier_keyless_qa_activation\.sql/);
    assert.match(surface, /20260802270000_0092_supplier_carrier_scope_integrity\.sql/);
    assert.match(surface, /20260802280000_0093_sun_tt_durable_truth_binding\.sql/);
    assert.match(surface, /20260802290000_0094_sun_runtime_acl_boundary\.sql/);
    assert.match(surface, /20260802300000_0095_sun_tt_conflict_target\.sql/);
    assert.match(surface, /20260802310000_0096_enterprise_rbac_risk_truth\.sql/);
    assert.match(surface, /20260829120000_0097_public_location_privacy\.sql/);
    assert.match(surface, /20260830120000_0098_event_location_context\.sql/);
    assert.match(surface, /20260831190000_0099_post_tap_location_observation\.sql/);
    assert.match(surface, /20260903120000_0100_event_incident_optimistic_concurrency\.sql/);
  }
  assert.match(target, /20260903120000_0100_event_incident_optimistic_concurrency\.sql/);
  assert.match(preflight, /has_function_privilege[\s\S]*nexid_prepare_tokenization_execution_v1/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_tokenization_execution_scope_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.tokenization_requests'\)/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_marketplace_request_asset_scope_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.marketplace_order_requests'\)/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_marketplace_offer_asset_scope_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.marketplace_offers'\)/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_marketplace_ownership_offer_invalidation_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.consumer_product_ownerships'\)/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_marketplace_tag_offer_invalidation_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.tags'\)/);
  assert.match(preflight, /trigger_row\.tgname = 'trg_nexid_marketplace_batch_offer_invalidation_v1'[\s\S]*trigger_row\.tgrelid = to_regclass\('public\.batches'\)/);
  assert.ok(runner.indexOf("assertSafeDbApplyStart") < runner.indexOf("CREATE TABLE IF NOT EXISTS schema_migrations"));
  assert.doesNotMatch(migration, /(?:ALTER|UPDATE|DELETE|INSERT)[^;]*(?:K_META|K_FILE|SDM|SUN)|hsm_backed\s*[:=]\s*true/i);
});
