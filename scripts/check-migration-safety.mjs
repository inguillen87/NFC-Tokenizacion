import fs from "node:fs/promises";
import path from "node:path";

import { normalizeSqlSourceForStaticAnalysis } from "./lib/sql-source-normalization.mjs";

const root = path.resolve(process.cwd(), "apps/api/db/migrations");
const readSql = async (id) => normalizeSqlSourceForStaticAnalysis(
  await fs.readFile(path.join(root, id), "utf8"),
);
const ids = [
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
  "20260725014500_0056_iota_evidence_constraints_validate.sql",
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726120000_0058_marketplace_runtime_baseline.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728143000_0063_supplier_packaging_governance.sql",
  "20260728160000_0064_webhook_lifecycle_governance.sql",
  "20260728173000_0065_event_incident_workflow.sql",
  "20260728180000_0066_tag_lifecycle_governance.sql",
  "20260728183000_0067_canonical_event_outbox.sql",
  "20260729110000_0068_epcis_event_type.sql",
  "20260729110500_0069_gs1_epcis_foundation.sql",
  "20260729130000_0070_supplier_qa_atomic_receipts.sql",
  "20260729143000_0071_supplier_pack_purpose_governance.sql",
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql",
  "20260730110000_0073_supplier_qa_verification_context_v2.sql",
  "20260730150000_0074_supplier_key_rotation_atomic.sql",
  "20260801090000_0075_supplier_production_qa_acceptance.sql",
  "20260802090000_0076_supplier_production_activation_v2.sql",
  "20260802113000_0077_tenant_api_key_lifecycle.sql",
  "20260802130000_0078_webhook_destination_cutover.sql",
  "20260802150000_0079_supplier_order_atomic_create.sql",
  "20260802153000_0080_offline_scan_history_index.sql",
  "20260802160000_0081_supplier_manifest_atomic_import.sql",
  "20260802170000_0082_consumer_session_revocation.sql",
  "20260802180000_0083_sdk_event_webhook_atomic_outbox.sql",
  "20260802185000_0083b_vault_artifact_status_bridge.sql",
  "20260802190000_0084_tenant_vault_audited_download.sql",
  "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
  "20260802210000_0086_supplier_order_lifecycle.sql",
  "20260802220000_0087_packaging_lab_foundation.sql",
  "20260802225000_0087b_webhook_delivery_identity_bridge.sql",
  "20260802230000_0088_enterprise_event_profile.sql",
  "20260802240000_0089_sun_carrier_trust_state.sql",
  "20260802250000_0090_supplier_carrier_key_scope.sql",
  "20260802255000_0090b_vault_artifact_canonical_bridge.sql",
  "20260802260000_0091_supplier_keyless_qa_activation.sql",
  "20260802270000_0092_supplier_carrier_scope_integrity.sql",
  "20260802280000_0093_sun_tt_durable_truth_binding.sql",
  "20260802290000_0094_sun_runtime_acl_boundary.sql",
  "20260802300000_0095_sun_tt_conflict_target.sql",
  "20260802310000_0096_enterprise_rbac_risk_truth.sql",
  "20260802320000_0097_sun_demo_replay_isolation.sql",
];
const checks = [];
for (const id of ids) {
  const sql = await readSql(id);
  checks.push({
    id,
    bytes: Buffer.byteLength(sql),
    hasExplicitTransactionControl: /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql),
  });
}
const sql55 = await readSql("20260724213000_0055_iota_executor_durable_broadcast.sql");
const sql56 = await readSql("20260725014500_0056_iota_evidence_constraints_validate.sql");
const sql58 = await readSql("20260726103000_0058_webhook_signature_v2.sql");
const sql58Marketplace = await readSql("20260726120000_0058_marketplace_runtime_baseline.sql");
const sql60 = await readSql("20260726173000_0060_sdk_idempotency_operations.sql");
const sql61 = await readSql("20260726190000_0061_supplier_export_artifact_delivery.sql");
const sql62 = await readSql("20260728120000_0062_sun_atomic_persistence.sql");
const sql63 = await readSql("20260728143000_0063_supplier_packaging_governance.sql");
const sql64 = await readSql("20260728160000_0064_webhook_lifecycle_governance.sql");
const sql65 = await readSql("20260728173000_0065_event_incident_workflow.sql");
const sql66 = await readSql("20260728180000_0066_tag_lifecycle_governance.sql");
const sql67 = await readSql("20260728183000_0067_canonical_event_outbox.sql");
const sql68 = await readSql("20260729110000_0068_epcis_event_type.sql");
const sql69 = await readSql("20260729110500_0069_gs1_epcis_foundation.sql");
const sql70 = await readSql("20260729130000_0070_supplier_qa_atomic_receipts.sql");
const sql71 = await readSql("20260729143000_0071_supplier_pack_purpose_governance.sql");
const sql72 = await readSql("20260729160000_0072_tokenization_marketplace_execution_governance.sql");
const sql73 = await readSql("20260730110000_0073_supplier_qa_verification_context_v2.sql");
const sql74 = await readSql("20260730150000_0074_supplier_key_rotation_atomic.sql");
const sql75 = await readSql("20260801090000_0075_supplier_production_qa_acceptance.sql");
const sql76 = await readSql("20260802090000_0076_supplier_production_activation_v2.sql");
const sql77 = await readSql("20260802113000_0077_tenant_api_key_lifecycle.sql");
const sql78 = await readSql("20260802130000_0078_webhook_destination_cutover.sql");
const sql79 = await readSql("20260802150000_0079_supplier_order_atomic_create.sql");
const sql80 = await readSql("20260802153000_0080_offline_scan_history_index.sql");
const sql81 = await readSql("20260802160000_0081_supplier_manifest_atomic_import.sql");
const sql82 = await readSql("20260802170000_0082_consumer_session_revocation.sql");
const sql83 = await readSql("20260802180000_0083_sdk_event_webhook_atomic_outbox.sql");
const sql83b = await readSql("20260802185000_0083b_vault_artifact_status_bridge.sql");
const sql84 = await readSql("20260802190000_0084_tenant_vault_audited_download.sql");
const sql85 = await readSql("20260802200000_0085_supplier_non_sun_qa_evidence.sql");
const sql86 = await readSql("20260802210000_0086_supplier_order_lifecycle.sql");
const sql87 = await readSql("20260802220000_0087_packaging_lab_foundation.sql");
const sql87b = await readSql("20260802225000_0087b_webhook_delivery_identity_bridge.sql");
const sql88 = await readSql("20260802230000_0088_enterprise_event_profile.sql");
const sql89 = await readSql("20260802240000_0089_sun_carrier_trust_state.sql");
const sql90 = await readSql("20260802250000_0090_supplier_carrier_key_scope.sql");
const sql90b = await readSql("20260802255000_0090b_vault_artifact_canonical_bridge.sql");
const sql91 = await readSql("20260802260000_0091_supplier_keyless_qa_activation.sql");
const sql92 = await readSql("20260802270000_0092_supplier_carrier_scope_integrity.sql");
const sql93 = await readSql("20260802280000_0093_sun_tt_durable_truth_binding.sql");
const sql94 = await readSql("20260802290000_0094_sun_runtime_acl_boundary.sql");
const sql95 = await readSql("20260802300000_0095_sun_tt_conflict_target.sql");
const sql96 = await readSql("20260802310000_0096_enterprise_rbac_risk_truth.sql");
const sql97 = await readSql("20260802320000_0097_sun_demo_replay_isolation.sql");
const executor = await fs.readFile(path.resolve(process.cwd(), "apps/executor/src/iota-idempotency.mjs"), "utf8");
const runner = await fs.readFile(path.resolve(process.cwd(), "apps/api/scripts/db-apply.mjs"), "utf8");
const runnerSafety = await fs.readFile(path.resolve(process.cwd(), "apps/api/scripts/lib/db-apply-safety.mjs"), "utf8");
const legacyRunner = await fs.readFile(path.resolve(process.cwd(), "apps/api/scripts/db-apply-file.mjs"), "utf8");
const drop = sql55.indexOf("DROP CONSTRAINT IF EXISTS iota_executor_publications_status_check");
const rewrite = sql55.indexOf("SET status = 'reserved'");
const hasProtocolCheck = sql55.includes("iota_executor_publications_protocol_v2_required_check");
const hasSignerNonceGuard = sql55.includes("uq_iota_executor_publications_signer_nonce")
  && /\(chain_id,\s*lower\(signer_address\),\s*nonce\)/m.test(sql55);
const validatesEvidenceConstraints = sql56.includes("VALIDATE CONSTRAINT evidence_anchors_iota_v2_proof_id_format")
  && sql56.includes("VALIDATE CONSTRAINT evidence_anchors_iota_v2_memo_hash_format");
const webhookV2MigrationPreservesLegacy = sql58.indexOf("SET signature_version = 'v1'") >= 0
  && sql58.indexOf("SET DEFAULT 'v2'") > sql58.indexOf("SET signature_version = 'v1'")
  && sql58.includes("CHECK (signature_version IN ('v1', 'v2'))");
const marketplaceRuntimeBaselineIsDurable = sql58Marketplace.includes("ADD COLUMN IF NOT EXISTS seller_consumer_id uuid")
  && sql58Marketplace.includes("ADD COLUMN IF NOT EXISTS resale_uid_hex text")
  && sql58Marketplace.includes("db-apply.mjs --only 20260726120000_0058_marketplace_runtime_baseline.sql")
  && ids.indexOf("20260726103000_0058_webhook_signature_v2.sql")
    < ids.indexOf("20260726120000_0058_marketplace_runtime_baseline.sql")
  && ids.indexOf("20260726120000_0058_marketplace_runtime_baseline.sql")
    < ids.indexOf("20260726135000_0059_marketplace_claim_truth_cleanup.sql");
const sdkIdempotencySchemaIsDurable = sql60.includes("CREATE TABLE IF NOT EXISTS sdk_idempotency_operations")
  && /\(tenant_id,\s*route,\s*idempotency_key\)/m.test(sql60)
  && sql60.includes("response_body_ciphertext text")
  && sql60.includes("idempotency_operation_id");
const supplierExportEnvelopeIsDurable = sql61.includes("encrypted_payload_base64")
  && sql61.includes("delivery_status")
  && sql61.includes("delivery_attempt_count");
const sunAtomicPersistenceIsDurable = sql62.includes("CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1")
  && sql62.includes("pg_advisory_xact_lock")
  && sql62.includes("FOR UPDATE")
  && sql62.includes("UPDATE tags")
  && sql62.includes("INSERT INTO events")
  && sql62.includes("sun_atomic_tag_uid_casefold_duplicates")
  && sql62.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_batch_uid_upper");
const supplierPackagingGovernanceIsDurable = sql63.includes("DEFAULT 'legacy_unverified'")
  && sql63.includes("CREATE TABLE IF NOT EXISTS supplier_packaging_governance_decisions")
  && sql63.includes("CREATE OR REPLACE FUNCTION public.nexid_record_supplier_packaging_decision_v1")
  && sql63.includes("FOR UPDATE")
  && sql63.includes("packaging_governance_revision_conflict")
  && sql63.includes("packaging_approval_separation_required")
  && sql63.includes("supplier_packaging_governance_history_is_immutable")
  && sql63.includes("packaging_governance_current_state_without_history")
  && sql63.includes("validateSupplierPackagingSpec")
  && sql63.includes("nexid_packaging_evidence_ref_present(evidence_refs, 'tagtamper_placement')");
const webhookLifecycleGovernanceIsDurable = sql64.includes("signing_secret_previous_valid_until")
  && sql64.includes("CREATE TABLE IF NOT EXISTS webhook_endpoint_audit_events")
  && sql64.includes("nexid_webhook_audit_append_only")
  && sql64.includes("webhook_audit_history_is_append_only")
  && sql64.includes("nexid_enforce_webhook_enabled_endpoint_limit_v1")
  && sql64.includes("webhook_enabled_endpoint_limit_preexisting")
  && sql64.includes("v_enabled_count >= 25")
  && sql64.includes("deleted_at IS NULL OR enabled = false");
const eventIncidentWorkflowIsDurable = sql65.includes("CREATE TABLE IF NOT EXISTS event_incidents")
  && sql65.includes("CREATE TABLE IF NOT EXISTS event_incident_history")
  && sql65.includes("CREATE OR REPLACE FUNCTION nexid_open_event_incident")
  && sql65.includes("CREATE OR REPLACE FUNCTION nexid_transition_event_incident")
  && sql65.includes("pg_advisory_xact_lock")
  && sql65.includes("FOREIGN KEY (event_id, event_created_at)")
  && sql65.includes("incident_event_tenant_conflict")
  && sql65.includes("incident_idempotency_key_conflict")
  && sql65.includes("event_incident_history_append_only");
const tagLifecycleGovernanceIsDurable = sql66.includes("CREATE TABLE IF NOT EXISTS tag_lifecycle_events")
  && sql66.includes("CREATE OR REPLACE FUNCTION nexid_transition_tag_lifecycle_v1")
  && sql66.includes("UNIQUE (tenant_id, operation_key)")
  && sql66.includes("FOR UPDATE OF tag")
  && sql66.includes("tag_lifecycle_history_is_append_only")
  && /count\(\*\) > 0\s+AND bool_and/m.test(sql66)
  && sql66.includes("v_supplier_gate_ok IS DISTINCT FROM TRUE")
  && /WHERE event\.id = v_receipt\.event_id\s+AND event\.created_at = v_receipt\.created_at/m.test(sql66)
  && sql66.includes("RENAME TO nexid_persist_sun_scan_v1_base_0062");
const canonicalEventOutboxIsDurable = sql67.includes("CREATE TABLE IF NOT EXISTS canonical_event_operations")
  && sql67.includes("CREATE OR REPLACE FUNCTION nexid_write_canonical_event_v1")
  && sql67.includes("UNIQUE (tenant_id, operation_key)")
  && /FOREIGN KEY \(source_event_id, source_event_created_at\)/m.test(sql67)
  && sql67.includes("canonical_event_reference_event_ambiguous")
  && sql67.includes("canonical_event_raw_query_invalid")
  && sql67.includes("canonical_event_idempotency_conflict")
  && sql67.includes("pg_advisory_xact_lock")
  && sql67.includes("INSERT INTO events")
  && sql67.includes("INSERT INTO webhook_deliveries")
  && sql67.includes("ON CONFLICT (endpoint_id, event_id) DO NOTHING");
const gs1EpcisFoundationIsDurable = sql68.includes("ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'EPCIS_EVENT_CAPTURED'")
  && !sql68.includes("CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1")
  && sql69.includes("CREATE TABLE IF NOT EXISTS gs1_digital_link_identities")
  && sql69.includes("uq_gs1_identity_public_path")
  && sql69.includes("CREATE TABLE IF NOT EXISTS epcis_capture_operations")
  && sql69.includes("CREATE TABLE IF NOT EXISTS epcis_events")
  && sql69.includes("CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1")
  && sql69.includes("epcis_unknown_gs1_identity")
  && sql69.includes("epcis_idempotency_conflict")
  && sql69.includes("pg_advisory_xact_lock")
  && sql69.includes("INSERT INTO events")
  && sql69.includes("INSERT INTO webhook_deliveries")
  && sql69.includes("declared_business_event")
  && sql69.includes("'cryptographic_authentication', false")
  && sql69.includes("epcis_append_only");
const gs1EpcisAvoidsBlockingActiveIndexes = !/CREATE UNIQUE INDEX IF NOT EXISTS uq_(?:batches_id_tenant_epcis|tenant_api_keys_id_tenant_epcis|canonical_event_operations_epcis_scope)/m.test(sql69)
  && /FOREIGN KEY \(batch_id\) REFERENCES batches\(id\)/m.test(sql69)
  && /FOREIGN KEY \(api_key_id\) REFERENCES tenant_api_keys\(id\)/m.test(sql69)
  && /FOREIGN KEY \(canonical_operation_id\)\s+REFERENCES canonical_event_operations\(id\)/m.test(sql69)
  && sql69.includes("nexid_reject_referenced_batch_reparent_v1")
  && sql69.includes("nexid_reject_referenced_api_key_reparent_v1")
  && sql69.includes("FOR SHARE");
const supplierQaAtomicCommitIsDurable = sql70.includes("CREATE TABLE IF NOT EXISTS sun_diagnostics")
  && sql70.includes("CREATE TABLE IF NOT EXISTS supplier_qa_diagnostic_consumptions")
  && sql70.includes("diagnostic_id bigint PRIMARY KEY REFERENCES sun_diagnostics(id) ON DELETE RESTRICT")
  && sql70.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_operation_key")
  && sql70.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_passed_sub_batch")
  && sql70.includes("CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_qa_v1")
  && sql70.includes("FOR UPDATE OF ssb, so, b, bk")
  && sql70.includes("pg_advisory_xact_lock")
  && sql70.includes("FOR UPDATE OF d")
  && sql70.includes("supplier_qa_idempotency_key_conflict")
  && sql70.includes("supplier_qa_snapshot_already_consumed")
  && sql70.includes("supplier_qa_history_is_append_only")
  && sql70.includes("INSERT INTO supplier_qa_checks")
  && sql70.includes("INSERT INTO supplier_qa_diagnostic_consumptions")
  && sql70.includes("INSERT INTO vault_artifacts")
  && sql70.includes("INSERT INTO evidence_events")
  && sql70.includes("INSERT INTO audit_logs")
  && sql70.includes("REVOKE ALL ON FUNCTION public.nexid_commit_supplier_qa_v1(jsonb) FROM PUBLIC");
const supplierPackPurposeGovernanceIsDurable = sql71.includes("SET pack_purpose = 'legacy_unclassified'")
  && sql71.includes("CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decisions")
  && sql71.includes("CREATE TABLE IF NOT EXISTS supplier_pack_purpose_decision_items")
  && sql71.includes("supplier_pack_purpose_history_is_append_only")
  && sql71.includes("CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL")
  && sql71.includes("supplier_pack_purpose_scope_enumeration_mismatch")
  && sql71.includes("supplier_pack_purpose_qa_receipt_mismatch")
  && sql71.includes("supplier_pack_purpose_classified_scope_is_frozen")
  && sql71.includes("CREATE OR REPLACE VIEW public.supplier_order_pack_purpose_effective_v1")
  && sql71.includes("CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_commercial_release_v1")
  && sql71.includes("sub_batch.tenant_id = v_batch.tenant_id AND upper(sub_batch.bid) = upper(v_batch.bid)")
  && sql71.includes("supplier_trial_integration_non_sellable")
  && sql71.includes("supplier_production_acceptance_v2_required")
  && sql71.includes("CREATE TRIGGER trg_supplier_sdk_pos_commercial_guard")
  && sql71.includes("CREATE TRIGGER trg_supplier_sdk_claim_commercial_guard")
  && sql71.includes("CREATE TRIGGER trg_supplier_consumer_ownership_commercial_guard")
  && sql71.includes("consumer_ownership_event_scope_invalid")
  && sql71.includes("REVOKE ALL ON FUNCTION public.nexid_supplier_commercial_sink_guard_v1() FROM PUBLIC")
  && !sql71.includes("hsm_backed: true");
const prepare72 = sql72.slice(sql72.indexOf("CREATE OR REPLACE FUNCTION public.nexid_prepare_tokenization_execution_v1"));
const simulationReturn72 = prepare72.indexOf("IF v_request.execution_class = 'simulation' OR v_request.status = 'simulated' THEN");
const historicalScope72 = prepare72.indexOf("This first lookup proves the immutable historical identity and SUN verdict");
const networkClassification72 = prepare72.indexOf("IF v_request.execution_class = 'testnet_trial' THEN", historicalScope72);
const anchoredReturn72 = prepare72.indexOf("IF v_request.status = 'anchored' THEN");
const revokedProjection72 = prepare72.indexOf("REVOKED_HISTORICAL_PROOF", anchoredReturn72);
const pendingEligibility72 = prepare72.indexOf("IF NOT v_current_asset_eligible THEN", revokedProjection72 + 1);
const pendingSupplierRelease72 = prepare72.indexOf(
  "PERFORM public.nexid_assert_supplier_commercial_release_v1(v_request.batch_id)",
  pendingEligibility72,
);
const anchoredHistoricalTruthIsSeparatedFromCurrentEligibility = simulationReturn72 >= 0
  && historicalScope72 > simulationReturn72
  && networkClassification72 > historicalScope72
  && anchoredReturn72 > networkClassification72
  && revokedProjection72 > anchoredReturn72
  && pendingEligibility72 > revokedProjection72
  && pendingSupplierRelease72 > pendingEligibility72;
const tokenizationMarketplaceExecutionGovernanceIsDurable = sql72.includes("ADD COLUMN IF NOT EXISTS source_event_created_at timestamptz")
  && sql72.includes("ADD COLUMN IF NOT EXISTS ownership_id uuid")
  && sql72.includes("ADD COLUMN IF NOT EXISTS source_tag_id uuid")
  && sql72.includes("'legacy_unclassified', 'simulation', 'testnet_trial', 'live_chain'")
  && sql72.includes("FOREIGN KEY (source_event_id, source_event_created_at)")
  && sql72.includes("REFERENCES events(id, created_at) ON DELETE RESTRICT NOT VALID")
  && !/FOREIGN KEY \(source_event_id\)\s+REFERENCES events\(id\)/m.test(sql72)
  && sql72.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_tokenization_request_asset_execution")
  && sql72.includes("tokenization_duplicate_asset_requires_reconciliation")
  && sql72.includes("CREATE OR REPLACE FUNCTION public.nexid_prepare_tokenization_execution_v1")
  && sql72.includes("'reconcile_required'::text")
  && sql72.includes("tokenization_testnet_trial_scope_required")
  && sql72.includes("tokenization_simulation_anchor_reconciliation_required")
  && sql72.includes("tokenization_historical_anchor_scope_unverified")
  && sql72.includes("tokenization_anchor_evidence_required")
  && sql72.includes("tokenization_reconciliation_retry_forbidden")
  && sql72.includes("tokenization_terminal_state_immutable")
  && sql72.includes("tokenization_asset_not_execution_eligible")
  && sql72.includes("REVOKED_HISTORICAL_PROOF")
  && sql72.includes("HISTORICAL_PROOF_NOT_CURRENTLY_SELLABLE")
  && sql72.includes("PERFORM public.nexid_assert_supplier_commercial_release_v1(v_request.batch_id)")
  && anchoredHistoricalTruthIsSeparatedFromCurrentEligibility
  && sql72.includes("CREATE TRIGGER trg_nexid_marketplace_offer_asset_scope_v1")
  && sql72.includes("CREATE TRIGGER trg_nexid_marketplace_ownership_offer_invalidation_v1")
  && sql72.includes("CREATE TRIGGER trg_nexid_marketplace_tag_offer_invalidation_v1")
  && sql72.includes("CREATE TRIGGER trg_nexid_marketplace_batch_offer_invalidation_v1")
  && sql72.includes("ownership_scope_not_currently_eligible")
  && sql72.includes("ownership_no_longer_claimed")
  && sql72.includes("tag_no_longer_marketplace_eligible")
  && sql72.includes("batch_no_longer_marketplace_eligible")
  && sql72.includes("marketplace_request_source_tuple_check")
  && sql72.includes("REVOKE ALL ON FUNCTION public.nexid_prepare_tokenization_execution_v1(uuid, uuid, uuid, text, integer) FROM PUBLIC")
  && !sql72.includes("VALIDATE CONSTRAINT")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql72);
const supplierQaVerificationContextV2IsDurable = sql73.includes("CREATE TABLE IF NOT EXISTS supplier_qa_verification_context_receipts")
  && sql73.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_canonical_json_v2")
  && sql73.includes('ORDER BY entry.key COLLATE "C"')
  && sql73.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_qa_verification_context_v2_capability()")
  && sql73.includes("CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_qa_v2")
  && sql73.includes("supplier-pack-purpose")
  && sql73.includes("FOR UPDATE OF ssb, so, b, bk")
  && sql73.includes("supplier_qa_verification_context_changed")
  && sql73.includes("supplier_qa_legacy_context_receipt_unbound")
  && sql73.includes("nexid_commit_supplier_qa_v1(p_input)")
  && sql73.includes("BEFORE UPDATE OR DELETE ON supplier_qa_verification_context_receipts")
  && sql73.includes("REVOKE ALL ON FUNCTION public.nexid_commit_supplier_qa_v2(jsonb) FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql73);
const supplierKeyRotationV2IsDurable = sql74.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_key_rotation_v2_capability()")
  && sql74.includes("CREATE OR REPLACE FUNCTION public.nexid_rotate_supplier_batch_keys_v2")
  && sql74.includes("supplier-pack-purpose")
  && sql74.includes("FOR UPDATE OF ssb, so, b, bk")
  && sql74.includes("FOR UPDATE OF bkm")
  && sql74.includes("supplier_key_rotation_qa_passed")
  && sql74.includes("GET DIAGNOSTICS v_rotated_count = ROW_COUNT")
  && sql74.includes("GET DIAGNOSTICS v_inserted_count = ROW_COUNT")
  && sql74.includes("GET DIAGNOSTICS v_pair_count = ROW_COUNT")
  && sql74.includes("GET DIAGNOSTICS v_batch_count = ROW_COUNT")
  && sql74.includes("GET DIAGNOSTICS v_sub_batch_count = ROW_COUNT")
  && sql74.includes("REVOKE ALL ON FUNCTION public.nexid_rotate_supplier_batch_keys_v2(jsonb) FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql74);
const supplierProductionQaAcceptanceV2IsDurable = sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_plans")
  && sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_plan_decisions")
  && sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_sessions")
  && sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_session_samples")
  && sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_decisions")
  && sql75.includes("CREATE TABLE IF NOT EXISTS supplier_production_qa_observations")
  && sql75.includes("CREATE OR REPLACE FUNCTION public.nexid_submit_supplier_production_qa_plan_v1")
  && sql75.includes("CREATE OR REPLACE FUNCTION public.nexid_decide_supplier_production_qa_plan_v1")
  && sql75.includes("CREATE OR REPLACE FUNCTION public.nexid_create_supplier_production_qa_session_v1")
  && sql75.includes("CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_production_qa_v1")
  && sql75.includes("supplier-production-acceptance/v2")
  && sql75.includes("exact_permission.resource = 'supplier'")
  && sql75.includes("exact_permission.action = 'production_qa_plan:approve'")
  && sql75.includes("BEFORE UPDATE OR DELETE ON supplier_production_qa_plan_decisions")
  && sql75.includes("REVOKE ALL ON FUNCTION public.nexid_decide_supplier_production_qa_plan_v1(jsonb) FROM PUBLIC")
  && sql75.includes("REVOKE ALL ON FUNCTION public.nexid_commit_supplier_production_qa_v1(jsonb) FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql75);
const supplierProductionActivationV2IsDurable = sql76.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_production_activation_receipt_v2")
  && sql76.includes("CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_production_activation_v2")
  && sql76.includes("CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_commercial_release_v1")
  && sql76.includes("CREATE OR REPLACE FUNCTION public.nexid_activate_supplier_tags_v2")
  && sql76.includes("CREATE TABLE IF NOT EXISTS supplier_production_activation_receipts")
  && sql76.includes("UNIQUE (tenant_id, operation_key)")
  && sql76.includes("request_fingerprint text NOT NULL")
  && sql76.includes("supplier_production_activation_history_is_append_only")
  && sql76.includes("supplier-production-activation-operation")
  && sql76.includes("supplier_production_activation_idempotency_conflict")
  && sql76.includes("v_existing.activated_uids")
  && sql76.includes("INSERT INTO supplier_production_activation_receipts")
  && sql76.includes("plan_decision.decision_status = 'approved'")
  && sql76.includes("plan_decision.approver_role = 'tenant_admin'")
  && sql76.includes("newer_plan.revision > plan.revision")
  && sql76.includes("receipt.schema_version = 'supplier-production-acceptance/v2'")
  && sql76.includes("receipt.status = 'passed'")
  && sql76.includes("qa_check.status = 'passed'")
  && sql76.includes("qa_check.acceptance_scope = 'production_lot'")
  && sql76.includes("receipt.decided_at <= session_row.expires_at")
  && sql76.includes("sub_batch.manifest_count = sub_batch.expected_quantity")
  && sql76.includes("session_row.lot_size = plan.lot_size")
  && sql76.includes("FOR SHARE OF supplier_order, sub_batch, batch, plan, plan_decision")
  && sql76.includes("UPDATE tags tag")
  && sql76.includes("INSERT INTO evidence_events")
  && sql76.includes("INSERT INTO audit_logs")
  && sql76.includes("REVOKE ALL ON TABLE supplier_production_activation_receipts FROM PUBLIC")
  && sql76.includes("REVOKE ALL ON FUNCTION public.nexid_activate_supplier_tags_v2(jsonb) FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql76);
const tenantApiKeyLifecycleV1IsDurable = sql77.includes("CREATE TABLE IF NOT EXISTS tenant_api_key_lifecycle_receipts")
  && sql77.includes("tenant_api_keys_status_check")
  && sql77.includes("tenant_api_keys_key_hash_format_check")
  && sql77.includes("tenant_api_keys_key_prefix_format_check")
  && sql77.includes("tenant_api_keys_name_check")
  && sql77.includes("tenant_api_keys_scopes_check")
  && sql77.includes("tenant_api_keys_metadata_object_check")
  && sql77.includes("tenant_api_key_lifecycle_history_is_append_only")
  && sql77.includes("tenant_api_key_identity_immutable")
  && sql77.includes("tenant_api_key_reactivation_forbidden")
  && sql77.includes("pg_advisory_xact_lock")
  && sql77.includes("api_key.expires_at IS NULL OR api_key.expires_at > now()")
  && sql77.includes("CREATE OR REPLACE FUNCTION public.nexid_create_tenant_api_key_v1")
  && sql77.includes("CREATE OR REPLACE FUNCTION public.nexid_mutate_tenant_api_key_v1")
  && sql77.includes("REVOKE ALL ON TABLE tenant_api_key_lifecycle_receipts FROM PUBLIC")
  && sql77.includes("REVOKE ALL ON FUNCTION public.nexid_create_tenant_api_key_v1(jsonb) FROM PUBLIC")
  && !/raw_(?:key|secret)\s+(?:text|bytea)/i.test(sql77)
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql77);
const webhookDestinationCutoverV1IsDurable = sql78.includes("destination_version bigint")
  && sql78.includes("CREATE OR REPLACE FUNCTION public.nexid_webhook_destination_version_v1")
  && sql78.includes("webhook_destination_has_fresh_lease")
  && sql78.includes("CREATE OR REPLACE FUNCTION public.nexid_webhook_delivery_destination_snapshot_v1")
  && sql78.includes("CREATE OR REPLACE FUNCTION public.nexid_webhook_delivery_identity_immutable_v1")
  && sql78.includes("webhook_destination_changed")
  && sql78.includes("REVOKE ALL ON FUNCTION public.nexid_webhook_destination_version_v1() FROM PUBLIC");
const supplierOrderPlpgsqlCaseComparisonsAreUnambiguous = [sql79, sql90].every((source) =>
  /IF upper\(COALESCE\(v_sdm_config->>'supplier_order_id', ''\)\)[\s\S]*?\)\s*<>\s*\(CASE WHEN v_secure_sun THEN 'secure_sun' ELSE 'none' END\)\s*OR\s*\(v_secure_sun AND COALESCE\(v_sdm_config->>'key_version', ''\) <> '1'\)/m.test(source));
const supplierOrderAtomicCreateV2IsDurable = sql79.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_order_create_v2_capability()")
  && sql79.includes("CREATE OR REPLACE FUNCTION public.nexid_create_supplier_order_v2(p_input jsonb)")
  && sql79.includes("SECURITY INVOKER")
  && sql79.includes("'supplier-bid' || chr(31)")
  && sql79.includes("INSERT INTO supplier_orders")
  && sql79.includes("INSERT INTO batches")
  && sql79.includes("INSERT INTO supplier_sub_batches")
  && sql79.includes("INSERT INTO batch_keys")
  && sql79.includes("INSERT INTO batch_key_material")
  && sql79.includes("INSERT INTO evidence_events")
  && sql79.includes("INSERT INTO audit_logs")
  && sql79.includes("'software_envelope', true")
  && sql79.includes("'managed_kms', false")
  && sql79.includes("'hsm_backed', false")
  && sql79.includes("REVOKE ALL ON FUNCTION public.nexid_create_supplier_order_v2(jsonb) FROM PUBLIC")
  && !/p_input\s*->>?\s*'(?:k_meta|k_file|raw_key|raw_secret)'/i.test(sql79)
  && !/'(?:managed_kms|hsm_backed)'\s*,\s*true/i.test(sql79)
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql79);
const offlineScanHistoryIndexIsDurable = sql80.includes("CREATE INDEX IF NOT EXISTS idx_offline_scan_events_tenant_history")
  && /ON offline_scan_events\s*\(tenant_id,\s*received_at DESC,\s*id DESC\)/m.test(sql80)
  && !/(?:raw_url|picc_data|cmac|uid_hex|key_material)/i.test(sql80);
const supplierManifestAtomicImportV2IsDurable = sql81.includes("CREATE TABLE IF NOT EXISTS tag_sun_payloads")
  && sql81.includes("tag_uid_global_uniqueness_preflight_failed")
  && sql81.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global")
  && /ON tags \(upper\(trim\(uid_hex\)\)\)/m.test(sql81)
  && sql81.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_manifest_import_v2_capability()")
  && sql81.includes("CREATE OR REPLACE FUNCTION public.nexid_import_tag_manifest_v2(p_input jsonb)")
  && sql81.includes("SECURITY INVOKER")
  && sql81.includes("JOIN memberships membership")
  && sql81.includes("auth_session.role::text = 'tenant_admin' AND auth_session.tenant_id = v_tenant_id")
  && sql81.includes("'physical-tag-uid' || chr(31)")
  && sql81.includes("supplier_manifest_quantity_override_forbidden")
  && sql81.includes("INSERT INTO tenant_manifests")
  && sql81.includes("INSERT INTO evidence_events")
  && sql81.includes("INSERT INTO audit_logs")
  && sql81.includes("REVOKE ALL ON FUNCTION public.nexid_import_tag_manifest_v2(jsonb) FROM PUBLIC")
  && !/p_input\s*->>?\s*'(?:k_meta|k_file|raw_key|raw_secret)'/i.test(sql81)
  && !/'(?:managed_kms|hsm_backed)'\s*,\s*true/i.test(sql81)
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql81);
const consumerSessionRevocationIsDurable = sql82.includes("ALTER TABLE consumer_sessions")
  && sql82.includes("ADD COLUMN IF NOT EXISTS revoked_at timestamptz")
  && sql82.includes("CREATE INDEX IF NOT EXISTS idx_consumer_sessions_active")
  && sql82.includes("WHERE revoked_at IS NULL");
const sdkEventWebhookAtomicOutboxIsDurable = sql83.includes("CREATE OR REPLACE FUNCTION public.nexid_enqueue_tenant_webhook_outbox_v1")
  && sql83.includes("CREATE OR REPLACE FUNCTION public.nexid_write_sdk_external_event_v1")
  && sql83.includes("SECURITY INVOKER")
  && sql83.includes("INSERT INTO public.sdk_external_events")
  && sql83.includes("FROM public.nexid_enqueue_tenant_webhook_outbox_v1")
  && sql83.includes("INSERT INTO public.webhook_deliveries")
  && sql83.includes("ON CONFLICT (endpoint_id, event_id) DO NOTHING")
  && sql83.includes("delivery.payload IS DISTINCT FROM v_payload")
  && sql83.includes("webhook_outbox_idempotency_conflict")
  && sql83.includes("endpoint.destination_version")
  && sql83.includes("v_attempted <> v_queued + v_deduplicated")
  && sql83.includes("REVOKE ALL ON FUNCTION public.nexid_enqueue_tenant_webhook_outbox_v1")
  && sql83.includes("REVOKE ALL ON FUNCTION public.nexid_write_sdk_external_event_v1")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql83);
const tenantVaultAuditedDownloadIsDurable = sql84.includes("CREATE TABLE IF NOT EXISTS vault_artifact_downloads")
  && sql84.includes("ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0")
  && sql84.includes("ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz")
  && sql84.includes("UNIQUE (artifact_id, idempotency_key)")
  && sql84.includes("CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$')")
  && sql84.includes("CHECK (receipt_sha256 ~ '^sha256:[0-9a-f]{64}$')")
  && sql84.includes("trg_vault_artifact_downloads_immutable")
  && sql84.includes("BEFORE UPDATE OR DELETE ON vault_artifact_downloads")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql84);
const vaultArtifactStatusBridgeIsDurable = sql83b.includes("ADD COLUMN IF NOT EXISTS status text")
  && /SET status = 'active'\s+WHERE status IS NULL/m.test(sql83b)
  && sql83b.includes("status NOT IN ('active', 'archived')")
  && sql83b.includes("ALTER COLUMN status SET NOT NULL")
  && sql83b.includes("VALIDATE CONSTRAINT vault_artifacts_status_check")
  && ids.indexOf("20260802180000_0083_sdk_event_webhook_atomic_outbox.sql")
    < ids.indexOf("20260802185000_0083b_vault_artifact_status_bridge.sql")
  && ids.indexOf("20260802185000_0083b_vault_artifact_status_bridge.sql")
    < ids.indexOf("20260802190000_0084_tenant_vault_audited_download.sql");
const supplierNonSunQaEvidenceIsDurable = sql85.includes("CREATE TABLE IF NOT EXISTS supplier_qa_carrier_evidence_receipts")
  && sql85.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_carrier_qa_v1_capability")
  && sql85.includes("CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_carrier_qa_v1")
  && sql85.includes("SECURITY INVOKER")
  && sql85.includes("trg_supplier_qa_carrier_receipts_append_only")
  && sql85.includes("server_verified_sun_evidence")
  && sql85.includes("cryptographic_authentication_verified")
  && sql85.includes("anti_replay_verified")
  && sql85.includes("activation_allowed")
  && sql85.includes("IS DISTINCT FROM\n      (CASE WHEN v_expected_carrier_profile = 'gs1_digital_link' THEN 'true' ELSE 'false' END) THEN")
  && sql85.includes("REVOKE ALL ON FUNCTION public.nexid_commit_supplier_carrier_qa_v1")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql85);
const supplierOrderLifecycleIsDurable = sql86.includes("CREATE TABLE IF NOT EXISTS supplier_order_lifecycle_receipts")
  && sql86.includes("UNIQUE (tenant_id, operation_key)")
  && sql86.includes("UNIQUE (supplier_order_id, transition)")
  && sql86.includes("trg_supplier_order_lifecycle_append_only")
  && sql86.includes("CREATE OR REPLACE FUNCTION public.nexid_transition_supplier_order_v1")
  && sql86.includes("SECURITY INVOKER")
  && sql86.includes("FOR UPDATE")
  && sql86.includes("auth_session.revoked_at IS NULL")
  && sql86.includes("auth_session.role::text = 'super_admin'")
  && sql86.includes("supplier_order_handover_qa_gate_required")
  && sql86.includes("supplier_order_handover_activation_complete_required")
  && sql86.includes("tenant_acceptance_claimed boolean NOT NULL DEFAULT false CHECK (tenant_acceptance_claimed = false)")
  && sql86.includes("physical_handover_verified boolean NOT NULL DEFAULT false CHECK (physical_handover_verified = false)")
  && sql86.includes("INSERT INTO evidence_events")
  && sql86.includes("INSERT INTO audit_logs")
  && sql86.includes("REVOKE ALL ON FUNCTION public.nexid_transition_supplier_order_v1")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql86);
const packagingLabFoundationIsDurable = sql87.includes("CREATE TABLE IF NOT EXISTS packaging_carrier_specs")
  && sql87.includes("CREATE TABLE IF NOT EXISTS packaging_placements")
  && sql87.includes("CREATE TABLE IF NOT EXISTS packaging_lab_projects")
  && sql87.includes("CREATE TABLE IF NOT EXISTS packaging_lab_test_cases")
  && sql87.includes("CREATE TABLE IF NOT EXISTS packaging_lab_approvals")
  && sql87.includes("CREATE OR REPLACE FUNCTION public.nexid_assert_packaging_lab_activation_v1")
  && sql87.includes("CREATE OR REPLACE FUNCTION public.nexid_assert_supplier_production_activation_v2")
  && sql87.includes("packaging_lab_approval_required")
  && sql87.includes("placement.crosses_opening")
  && sql87.includes("placement.requires_tail_break")
  && sql87.includes("trg_packaging_lab_tag_activation_guard")
  && sql87.includes("REVOKE ALL ON TABLE packaging_lab_approvals FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql87);
const webhookDeliveryIdentityBridgeIsDurable = sql87b.includes("v_delivery_count <> 0")
  && sql87b.includes("v_foreign_key_count <> 0")
  && sql87b.includes("ALTER COLUMN id TYPE bigint USING NULL::bigint")
  && sql87b.includes("CREATE SEQUENCE IF NOT EXISTS public.webhook_deliveries_id_seq AS bigint")
  && sql87b.includes("OWNED BY public.webhook_deliveries.id")
  && sql87b.includes("ALTER COLUMN id SET DEFAULT nextval")
  && ids.indexOf("20260802220000_0087_packaging_lab_foundation.sql")
    < ids.indexOf("20260802225000_0087b_webhook_delivery_identity_bridge.sql")
  && ids.indexOf("20260802225000_0087b_webhook_delivery_identity_bridge.sql")
    < ids.indexOf("20260802230000_0088_enterprise_event_profile.sql");
const enterpriseEventProfileIsDurable = sql88.includes("'cropwise_physical_product_event'")
  && sql88.includes("CREATE TABLE IF NOT EXISTS webhook_delivery_attempts")
  && sql88.includes("CREATE TABLE IF NOT EXISTS webhook_delivery_replay_receipts")
  && sql88.includes("CREATE OR REPLACE FUNCTION public.nexid_replay_webhook_delivery_v1")
  && sql88.includes("CREATE OR REPLACE FUNCTION public.nexid_write_sdk_external_event_v1")
  && sql88.includes("ADD COLUMN IF NOT EXISTS allowed_ip_cidrs cidr[]")
  && sql88.includes("ADD COLUMN IF NOT EXISTS allowed_origins text[]")
  && sql88.includes("ADD COLUMN IF NOT EXISTS triggered_rules jsonb")
  && sql88.includes("ADD COLUMN IF NOT EXISTS recommended_action text")
  && sql88.includes("REVOKE ALL ON FUNCTION public.nexid_write_sdk_external_event_v1(jsonb) FROM PUBLIC");
const sunCarrierTrustStateIsDurable = sql89.includes("CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1_base_0062")
  && sql89.includes("pg_advisory_xact_lock")
  && sql89.includes("v_carrier_profile_code = 'ntag424_dna' THEN 'VALID_AUTHENTIC'")
  && sql89.includes("v_carrier_profile_code = 'ntag424_dna_tt'")
  && sql89.includes("'VALID_UNKNOWN_TAMPER'")
  && sql89.includes("WHEN NOT v_crypto_verified THEN 'SUN_PROFILE_MISMATCH'")
  && sql89.indexOf("WHEN NOT v_crypto_verified") < sql89.indexOf("WHEN NOT v_allowlisted")
  && sql89.indexOf("WHEN NOT v_allowlisted") < sql89.indexOf("WHEN v_replay_suspect")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql89);
const supplierCarrierKeyScopeIsDurable = sql90.includes("ALTER TABLE batches ALTER COLUMN meta_key_ct DROP NOT NULL")
  && sql90.includes("ALTER TABLE batches ALTER COLUMN file_key_ct DROP NOT NULL")
  && sql90.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_order_create_keyless_v1_capability()")
  && sql90.includes("CREATE OR REPLACE FUNCTION public.nexid_create_supplier_order_v2(p_input jsonb)")
  && sql90.includes("v_secure_sun := v_carrier_profile_code IN ('ntag424_dna', 'ntag424_dna_tt')")
  && sql90.includes("IF v_secure_sun THEN")
  && sql90.includes("batches_supplier_carrier_key_scope_v1")
  && sql90.includes("NOT VALID")
  && sql90.includes("trg_batch_keys_supplier_carrier_scope_v1")
  && sql90.includes("trg_batch_key_material_supplier_carrier_scope_v1")
  && sql90.includes("REVOKE ALL ON FUNCTION public.nexid_create_supplier_order_v2(jsonb) FROM PUBLIC")
  && sql90.includes("'managed_kms', false")
  && sql90.includes("'hsm_backed', false")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql90);
const vaultArtifactCanonicalBridgeIsDurable = sql90b.includes("ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid")
  && sql90b.includes("ADD COLUMN IF NOT EXISTS content_hash text")
  && sql90b.includes("vault_artifact_content_hash_conflict")
  && sql90b.includes("vault_artifact_content_hash_unrecoverable")
  && sql90b.includes("vault_artifact_content_hash_noncanonical")
  && sql90b.includes("vault_artifact_sub_batch_scope_reconciliation_required")
  && sql90b.includes("artifact_type TYPE text USING artifact_type::text")
  && sql90b.includes("ALTER COLUMN content_hash SET NOT NULL")
  && sql90b.includes("VALIDATE CONSTRAINT vault_artifacts_supplier_sub_batch_id_fkey")
  && ids.indexOf("20260802250000_0090_supplier_carrier_key_scope.sql")
    < ids.indexOf("20260802255000_0090b_vault_artifact_canonical_bridge.sql")
  && ids.indexOf("20260802255000_0090b_vault_artifact_canonical_bridge.sql")
    < ids.indexOf("20260802260000_0091_supplier_keyless_qa_activation.sql");
const supplierKeylessQaActivationIsDurable = sql91.includes("CREATE TABLE IF NOT EXISTS supplier_keyless_production_qa_acceptance_receipts")
  && sql91.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_keyless_qa_activation_v1_capability()")
  && sql91.includes("CREATE OR REPLACE FUNCTION public.nexid_commit_supplier_carrier_qa_v1(p_input jsonb)")
  && sql91.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_keyless_production_activation_receipt_v1(")
  && sql91.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_production_activation_receipt_v2(p_batch_id uuid)")
  && sql91.includes("NOT EXISTS (\n      SELECT 1 FROM batch_keys unexpected_key")
  && sql91.includes("key_material_mode text NOT NULL DEFAULT 'none' CHECK (key_material_mode = 'none')")
  && sql91.includes("managed_kms boolean NOT NULL DEFAULT false CHECK (managed_kms IS FALSE)")
  && sql91.includes("hsm_backed boolean NOT NULL DEFAULT false CHECK (hsm_backed IS FALSE)")
  && sql91.includes("REVOKE ALL ON FUNCTION public.nexid_supplier_keyless_qa_activation_v1_capability() FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql91);
const supplierCarrierScopeIntegrityIsDurable = sql92.includes("CREATE OR REPLACE FUNCTION public.nexid_supplier_carrier_scope_integrity_v1_capability()")
  && sql92.includes("CREATE OR REPLACE FUNCTION public.nexid_enforce_supplier_batch_key_carrier_scope_v1()")
  && sql92.includes("BEFORE INSERT OR UPDATE ON batch_keys")
  && sql92.includes("BEFORE INSERT OR UPDATE ON batch_key_material")
  && sql92.includes("lower(btrim(batch.carrier_profile_code)) = lower(btrim(supplier_order.carrier_profile_code))")
  && sql92.includes("(manifest_row.value->>'carrier_profile_code') IS DISTINCT FROM v_batch_carrier")
  && sql92.includes("jsonb_typeof(manifest_row.value->'sun_payload') IS DISTINCT FROM 'object'")
  && sql92.includes("WHERE manifest_row.value ? 'sun_payload'")
  && sql92.includes("REVOKE ALL ON FUNCTION public.nexid_supplier_carrier_scope_integrity_v1_capability() FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql92);
const sunTtDurableTruthIsDurable = sql93.includes("CREATE OR REPLACE FUNCTION public.nexid_sun_tt_durable_truth_v1_capability()")
  && sql93.includes("CREATE TABLE IF NOT EXISTS public.sun_tt_truth_receipts")
  && sql93.includes("trg_sun_tt_truth_receipts_append_only")
  && sql93.includes("WHEN '4343' THEN 'VALID_CLOSED'")
  && sql93.includes("WHEN '4F4F' THEN 'VALID_OPENED'")
  && sql93.includes("WHEN '4F43' THEN 'VALID_OPENED_PREVIOUSLY'")
  && sql93.includes("v_binding_reason := 'tt_raw_missing_or_noncanonical'")
  && sql93.includes("v_binding_reason := 'tt_force_result_contradiction'")
  && sql93.includes("'SUN_PROFILE_MISMATCH', 'NOT_ACTIVE', 'REVOKED', 'BROKEN', 'TAMPER_RISK'")
  && sql93.includes("REVOKE ALL ON FUNCTION public.nexid_sun_tt_durable_truth_v1_capability() FROM PUBLIC")
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql93);
const sunRuntimeAclBoundaryIsDurable = sql94.includes("CREATE OR REPLACE FUNCTION public.nexid_sun_runtime_acl_v1_capability()")
  && sql94.includes("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
  && sql94.includes("ALTER FUNCTION public.nexid_persist_sun_scan_v1(jsonb) SECURITY DEFINER")
  && sql94.includes("SET search_path TO pg_catalog, public, pg_temp")
  && sql94.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) FROM PUBLIC")
  && sql94.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) FROM PUBLIC")
  && sql94.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC")
  && !/GRANT\s+EXECUTE[\s\S]*nexid_persist_sun_scan_v1_base_0062/i.test(sql94)
  && !/hsm[_ -]?backed\s*[:=]\s*true/i.test(sql94);
const sunTtConflictTargetIsDurable = sql95.includes("CREATE OR REPLACE FUNCTION public.nexid_sun_tt_conflict_target_v1_capability()")
  && sql95.includes("v_old_conflict_target constant text := 'ON CONFLICT (event_id, event_created_at) DO NOTHING'")
  && sql95.includes("v_new_conflict_target constant text := 'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING'")
  && sql95.includes("EXECUTE replace(v_function_definition, v_old_conflict_target, v_new_conflict_target)")
  && sql95.includes("constraint_row.conname = 'sun_tt_truth_receipts_pkey'")
  && sql95.includes("constraint_row.contype = 'p'")
  && sql95.includes("ARRAY['event_id', 'event_created_at']::text[]")
  && sql95.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1(jsonb) FROM PUBLIC")
  && sql95.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_0062(jsonb) FROM PUBLIC")
  && sql95.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC")
  && sql95.includes("REVOKE ALL ON FUNCTION public.nexid_sun_tt_conflict_target_v1_capability() FROM PUBLIC")
  && !/GRANT\s+EXECUTE[\s\S]*nexid_persist_sun_scan_v1_base_0062/i.test(sql95)
  && !/(?:CREATE|ALTER|DROP)\s+TABLE|TRUNCATE|UPDATE\s+public\.(?:tags|events|sun_counter_state)|DELETE\s+FROM/i.test(sql95)
  && !/hsm[_ -]?backed\s*[:=]\s*true|managed[_ -]?kms\s*[:=]\s*true/i.test(sql95);
const enterpriseRbacRiskTruthIsDurable = sql96.includes("ADD COLUMN IF NOT EXISTS risk_profile_version text")
  && sql96.includes("DROP CONSTRAINT IF EXISTS events_risk_profile_version_check")
  && sql96.includes("VALIDATE CONSTRAINT events_risk_profile_version_check")
  && sql96.includes("risk_profile_version = 'nexid-risk-v1'")
  && sql96.includes("CREATE TABLE IF NOT EXISTS public.event_risk_projections")
  && /CONSTRAINT event_risk_projections_pkey PRIMARY KEY \(\s*event_id, event_created_at, risk_profile_version\s*\)/m.test(sql96)
  && sql96.includes("CREATE INDEX IF NOT EXISTS idx_event_risk_projections_tenant_created")
  && sql96.includes("ARRAY['tenant_id', 'risk_profile_version', 'event_created_at', 'event_id']::text[]")
  && sql96.includes("pg_index_column_has_property(index_row.indexrelid, 1, 'asc') IS TRUE")
  && sql96.includes("pg_index_column_has_property(index_row.indexrelid, 2, 'asc') IS TRUE")
  && sql96.includes("pg_index_column_has_property(index_row.indexrelid, 3, 'desc') IS TRUE")
  && sql96.includes("pg_index_column_has_property(index_row.indexrelid, 4, 'desc') IS TRUE")
  && sql96.includes("CREATE OR REPLACE FUNCTION public.nexid_compute_event_risk_v1(")
  && /nexid_compute_event_risk_v1\([\s\S]*?IMMUTABLE\s+PARALLEL SAFE/m.test(sql96)
  && !/nexid_compute_event_risk_v1\([\s\S]*?FROM public\.batches[\s\S]*?\$enterprise_event_risk_compute_v1\$/m.test(sql96)
  && sql96.includes("CREATE OR REPLACE FUNCTION public.nexid_explain_event_risk_v1()")
  && sql96.includes("NEW.risk_score := v_projection.risk_score")
  && sql96.includes("NEW.triggered_rules := v_projection.triggered_rules")
  && sql96.includes("NEW.risk_profile_version := v_projection.risk_profile_version")
  && /FROM public\.batches batch[\s\S]*?batch\.tenant_id = NEW\.tenant_id/m.test(sql96)
  && /OLD\.triggered_rules[\s\S]*?BATCH_QUARANTINED/m.test(sql96)
  && /BEFORE INSERT OR UPDATE OF\s+tenant_id, event_type/m.test(sql96)
  && /risk_score, risk_level, triggered_rules, recommended_action,\s+risk_profile_version/m.test(sql96)
  && sql96.includes("CREATE OR REPLACE FUNCTION public.nexid_backfill_event_risk_v1(p_limit integer)")
  && sql96.includes("p_limit > 5000")
  && sql96.includes("FOR UPDATE OF event_row SKIP LOCKED")
  && sql96.includes("INSERT INTO public.event_risk_projections")
  && /event_row\.triggered_rules[\s\S]*?BATCH_QUARANTINED/m.test(sql96)
  && sql96.includes("ON CONFLICT (event_id, event_created_at, risk_profile_version) DO NOTHING")
  && !/UPDATE\s+public\.events/i.test(sql96)
  && sql96.includes("REVOKE ALL ON FUNCTION public.nexid_backfill_event_risk_v1(integer) FROM PUBLIC")
  && sql96.includes("SECURITY INVOKER")
  && sql96.includes("memberships_enterprise_tenant_binding_check")
  && sql96.includes("auth_sessions_enterprise_tenant_binding_check")
  && sql96.includes("VALIDATE CONSTRAINT memberships_enterprise_tenant_binding_check")
  && sql96.includes("VALIDATE CONSTRAINT auth_sessions_enterprise_tenant_binding_check")
  && sql96.includes("'api_integration', 'API integration service account', true, false")
  && sql96.includes("'super_admin', 'Super admin', false, true")
  && sql96.includes("'reseller', 'Legacy reseller compatibility', true, true")
  && sql96.includes("'tenant_owner', 'Tenant owner', true, true")
  && sql96.includes("'tenant_admin', 'Tenant admin', true, true")
  && sql96.includes("ALTER TABLE public.resource_permissions\n  ADD COLUMN IF NOT EXISTS tenant_id uuid")
  && sql96.includes("resource_permissions_tenant_backfill_ambiguous")
  && sql96.includes("v_global_memberships > 0 AND v_tenant_count = 0")
  && sql96.includes("v_global_memberships = 0 AND v_tenant_count = 1")
  && sql96.includes("ADD CONSTRAINT resource_permissions_tenant_id_fkey")
  && sql96.includes("CREATE UNIQUE INDEX IF NOT EXISTS ux_resource_permissions_tenant_scope")
  && sql96.includes("CREATE UNIQUE INDEX IF NOT EXISTS ux_resource_permissions_global_scope")
  && /CREATE CONSTRAINT TRIGGER trg_resource_permissions_tenant_scope[\s\S]*?DEFERRABLE INITIALLY DEFERRED/i.test(sql96)
  && /CREATE CONSTRAINT TRIGGER trg_memberships_permission_scope[\s\S]*?DEFERRABLE INITIALLY DEFERRED/i.test(sql96)
  && (sql96.match(/UPDATE\s+public\.resource_permissions\s+permission/gi) || []).length === 1
  && !/(?:INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?resource_permissions\b/i.test(sql96)
  && !/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?memberships\b/i.test(sql96)
  && !/hsm[_ -]?backed\s*[:=]\s*true|managed[_ -]?kms\s*[:=]\s*true/i.test(sql96);

const sun97RepairStart = sql97.indexOf("DO $sun_demo_watermark_repair$");
const sun97RepairEnd = sql97.indexOf("REVOKE ALL ON TABLE", sun97RepairStart);
const sun97Repair = sun97RepairStart >= 0 && sun97RepairEnd > sun97RepairStart
  ? sql97.slice(sun97RepairStart, sun97RepairEnd)
  : "";
const sun97QuarantineStart = sql97.indexOf("CREATE OR REPLACE FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1");
const sun97QuarantineEnd = sql97.indexOf("CREATE OR REPLACE FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability", sun97QuarantineStart);
const sun97Quarantine = sun97QuarantineStart >= 0 && sun97QuarantineEnd > sun97QuarantineStart
  ? sql97.slice(sun97QuarantineStart, sun97QuarantineEnd)
  : "";
const sunDemoReplayIsolationIsDurable = sql97.includes("sun_demo_replay_isolation_requires_0096")
  && sql97.includes("CREATE TABLE IF NOT EXISTS public.sun_replay_watermark_repairs")
  && sql97.includes("PRIMARY KEY (repair_version, tag_id)")
  && sql97.includes("CREATE TRIGGER trg_sun_replay_watermark_repairs_append_only")
  && sql97.includes("sun_replay_watermark_repair_is_append_only")
  && sql97.includes("CREATE OR REPLACE FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability()")
  && sql97.includes("SELECT 'sun-demo-replay-isolation/v1'::text")
  && sql97.includes("ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) SECURITY INVOKER")
  && sql97.includes("SET search_path TO pg_catalog, public, pg_temp")
  && sql97.includes("REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC")
  && sql97.includes("REVOKE ALL ON TABLE public.sun_replay_watermark_repairs FROM PUBLIC")
  && sun97Quarantine.includes("CREATE TABLE IF NOT EXISTS public.sun_automated_fetch_quarantines")
  && sun97Quarantine.includes("FOREIGN KEY (event_id, event_created_at)")
  && sun97Quarantine.includes("REFERENCES public.events(id, created_at) ON DELETE RESTRICT")
  && sun97Quarantine.includes("CREATE TRIGGER trg_sun_automated_fetch_quarantines_append_only")
  && sun97Quarantine.includes("sun_automated_fetch_quarantine_is_append_only")
  && sun97Quarantine.includes("CREATE TRIGGER trg_events_capture_sun_automated_fetch_v1")
  && sun97Quarantine.includes("AFTER INSERT ON public.events")
  && sun97Quarantine.includes("SECURITY DEFINER")
  && sun97Quarantine.includes("ON CONFLICT (classification_version, event_id, event_created_at) DO NOTHING")
  && sun97Quarantine.includes("REVOKE ALL ON TABLE public.sun_automated_fetch_quarantines FROM PUBLIC")
  && !/(?:DELETE\s+FROM|UPDATE)\s+(?:public\.)?events\b|TRUNCATE/i.test(sun97Quarantine)
  && sql97.includes("REVOKE ALL ON FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability() FROM PUBLIC")
  && (sql97.split("CASE WHEN LOWER(COALESCE(e.source::text, 'real')) = 'demo' THEN 'demo' ELSE 'operational' END").length - 1) === 2
  && sql97.includes("v_execution_class := CASE WHEN v_source = 'demo' THEN 'demo' ELSE 'operational' END")
  && sql97.includes("IF v_execution_class = 'operational'")
  && sql97.includes("IF v_tag_id IS NOT NULL AND v_execution_class = 'operational' THEN")
  && sql97.includes("ELSIF v_tag_id IS NOT NULL THEN")
  && sql97.includes("v_last_seen_ctr := v_previous_last_seen_ctr")
  && sql97.includes("'replay_execution_class', v_execution_class")
  && sun97Repair.includes("pg_advisory_xact_lock")
  && sun97Repair.includes("MAX(COALESCE(event.sdm_read_ctr, event.read_counter))")
  && sun97Repair.includes("event.cmac_ok IS TRUE")
  && sun97Repair.includes("LOWER(COALESCE(event.source::text, 'real')) <> 'demo'")
  && sun97Repair.includes("GET DIAGNOSTICS v_inserted = ROW_COUNT")
  && /IF v_inserted = 1 THEN[\s\S]*SET last_seen_ctr = v_repaired_last_seen_ctr/m.test(sun97Repair)
  && !/(?:DELETE\s+FROM|UPDATE)\s+(?:public\.)?events\b|TRUNCATE/i.test(sun97Repair)
  && !/SET\s+(?:scan_count|first_seen_at|last_seen_at)\s*=/i.test(sun97Repair)
  && sql97.includes("sun_demo_replay_isolation_postcondition_failed")
  && !/hsm[_ -]?backed\s*[:=]\s*true|managed[_ -]?kms\s*[:=]\s*true/i.test(sql97);

const allMigrationFiles = (await fs.readdir(root)).filter((file) => file.endsWith(".sql")).sort();
let tenantApiKeysMaterialized = false;
let tenantApiKeysCanonicalCreateFound = false;
let tenantApiKeysCleanOrderSafe = true;
let partitionedEventReferencesAreCompositeSafe = true;
let postgresTextNullDelimiterFree = true;
for (const file of allMigrationFiles) {
  const source = await readSql(file);
  if (/REFERENCES\s+(?:public\.)?events\s*\(\s*id\s*\)/i.test(source)) {
    partitionedEventReferencesAreCompositeSafe = false;
  }
  if (/\bchr\s*\(\s*0\s*\)/i.test(source)) {
    postgresTextNullDelimiterFree = false;
  }
  const statements = [...source.matchAll(/CREATE TABLE IF NOT EXISTS tenant_api_keys|ALTER TABLE(?: IF EXISTS)? tenant_api_keys/g)];
  for (const statement of statements) {
    if (statement[0].startsWith("CREATE TABLE")) {
      tenantApiKeysMaterialized = true;
      tenantApiKeysCanonicalCreateFound = true;
    } else if (!tenantApiKeysMaterialized && statement[0] !== "ALTER TABLE IF EXISTS tenant_api_keys") {
      tenantApiKeysCleanOrderSafe = false;
    }
  }
}
tenantApiKeysCleanOrderSafe = tenantApiKeysCleanOrderSafe && tenantApiKeysCanonicalCreateFound;
const executorMatchesDurableStateMachine = /VALUES\s*\([^)]*'reserved'/s.test(executor)
  && /SET status = 'signed'/m.test(executor)
  && /SET status = 'broadcast'/m.test(executor)
  && /SET status = 'submitted'/m.test(executor)
  && !/VALUES\s*\([^)]*'processing'/s.test(executor)
  && !/status\s*=\s*'processing'/m.test(executor);
const runnerIsAtomic = runner.includes("containsExplicitTransactionControl")
  && runner.includes("historicalGaps")
  && runner.includes("SET LOCAL lock_timeout")
  && runner.includes("INSERT INTO schema_migrations");
const unauthorizedCleanBootstrapFailsClosed = runner.includes("  assertSafeDbApplyStart({")
  && runner.indexOf("  assertSafeDbApplyStart({") < runner.indexOf("CREATE TABLE IF NOT EXISTS schema_migrations")
  && runnerSafety.includes('DbApplySafetyError("canonical_baseline_required"')
  && runnerSafety.includes("database_mutated: false")
  && runnerSafety.includes("canonical-database-baseline-required.md");
const legacyBypassBlocked = legacyRunner.includes("IOTA V2 migrations require the allowlisted transactional staging runner");
const ok = checks.every((item) => item.bytes > 0)
  && drop >= 0 && rewrite > drop && hasProtocolCheck && hasSignerNonceGuard && validatesEvidenceConstraints
  && executorMatchesDurableStateMachine && webhookV2MigrationPreservesLegacy
  && marketplaceRuntimeBaselineIsDurable
  && sdkIdempotencySchemaIsDurable && supplierExportEnvelopeIsDurable && sunAtomicPersistenceIsDurable
  && supplierPackagingGovernanceIsDurable && webhookLifecycleGovernanceIsDurable
  && eventIncidentWorkflowIsDurable && tagLifecycleGovernanceIsDurable
  && canonicalEventOutboxIsDurable && gs1EpcisFoundationIsDurable
  && gs1EpcisAvoidsBlockingActiveIndexes && supplierQaAtomicCommitIsDurable
  && supplierPackPurposeGovernanceIsDurable && tokenizationMarketplaceExecutionGovernanceIsDurable
  && supplierQaVerificationContextV2IsDurable
  && supplierKeyRotationV2IsDurable
  && supplierProductionQaAcceptanceV2IsDurable
  && supplierProductionActivationV2IsDurable
  && tenantApiKeyLifecycleV1IsDurable
  && webhookDestinationCutoverV1IsDurable
  && supplierOrderPlpgsqlCaseComparisonsAreUnambiguous
  && supplierOrderAtomicCreateV2IsDurable
  && offlineScanHistoryIndexIsDurable
  && supplierManifestAtomicImportV2IsDurable
  && consumerSessionRevocationIsDurable
  && sdkEventWebhookAtomicOutboxIsDurable
  && vaultArtifactStatusBridgeIsDurable
  && tenantVaultAuditedDownloadIsDurable
  && supplierNonSunQaEvidenceIsDurable
  && supplierOrderLifecycleIsDurable
  && packagingLabFoundationIsDurable
  && webhookDeliveryIdentityBridgeIsDurable
  && enterpriseEventProfileIsDurable
  && sunCarrierTrustStateIsDurable
  && supplierCarrierKeyScopeIsDurable
  && vaultArtifactCanonicalBridgeIsDurable
  && supplierKeylessQaActivationIsDurable
  && supplierCarrierScopeIntegrityIsDurable
  && sunTtDurableTruthIsDurable
  && sunRuntimeAclBoundaryIsDurable
  && sunTtConflictTargetIsDurable
  && enterpriseRbacRiskTruthIsDurable
  && sunDemoReplayIsolationIsDurable
  && tenantApiKeysCleanOrderSafe && partitionedEventReferencesAreCompositeSafe
  && postgresTextNullDelimiterFree
  && runnerIsAtomic && unauthorizedCleanBootstrapFailsClosed && legacyBypassBlocked
  && checks.every((item) => !item.hasExplicitTransactionControl);
console.log(JSON.stringify({
  ok,
  gate: "migration_safety",
  migrations: checks,
  assertions: {
    status_constraint_dropped_before_rewrite: rewrite > drop,
    protocol_v2_check: hasProtocolCheck,
    signer_nonce_guard: hasSignerNonceGuard,
    evidence_constraints_validated: validatesEvidenceConstraints,
    webhook_v2_preserves_existing_v1: webhookV2MigrationPreservesLegacy,
    marketplace_runtime_baseline_is_durable: marketplaceRuntimeBaselineIsDurable,
    sdk_idempotency_schema_is_durable: sdkIdempotencySchemaIsDurable,
    supplier_export_envelope_is_durable: supplierExportEnvelopeIsDurable,
    sun_atomic_persistence_is_durable: sunAtomicPersistenceIsDurable,
    supplier_packaging_governance_is_durable: supplierPackagingGovernanceIsDurable,
    webhook_lifecycle_governance_is_durable: webhookLifecycleGovernanceIsDurable,
    event_incident_workflow_is_durable: eventIncidentWorkflowIsDurable,
    tag_lifecycle_governance_is_durable: tagLifecycleGovernanceIsDurable,
    canonical_event_outbox_is_durable: canonicalEventOutboxIsDurable,
    gs1_epcis_foundation_is_durable: gs1EpcisFoundationIsDurable,
    gs1_epcis_avoids_blocking_active_indexes: gs1EpcisAvoidsBlockingActiveIndexes,
    supplier_qa_atomic_commit_is_durable: supplierQaAtomicCommitIsDurable,
    supplier_pack_purpose_governance_is_durable: supplierPackPurposeGovernanceIsDurable,
    tokenization_marketplace_execution_governance_is_durable: tokenizationMarketplaceExecutionGovernanceIsDurable,
    supplier_qa_verification_context_v2_is_durable: supplierQaVerificationContextV2IsDurable,
    supplier_key_rotation_v2_is_durable: supplierKeyRotationV2IsDurable,
    supplier_production_qa_acceptance_v2_is_durable: supplierProductionQaAcceptanceV2IsDurable,
    supplier_production_activation_v2_is_durable: supplierProductionActivationV2IsDurable,
    tenant_api_key_lifecycle_v1_is_durable: tenantApiKeyLifecycleV1IsDurable,
    webhook_destination_cutover_v1_is_durable: webhookDestinationCutoverV1IsDurable,
    supplier_order_plpgsql_case_comparisons_are_unambiguous: supplierOrderPlpgsqlCaseComparisonsAreUnambiguous,
    supplier_order_atomic_create_v2_is_durable: supplierOrderAtomicCreateV2IsDurable,
    offline_scan_history_index_is_durable: offlineScanHistoryIndexIsDurable,
    supplier_manifest_atomic_import_v2_is_durable: supplierManifestAtomicImportV2IsDurable,
    consumer_session_revocation_is_durable: consumerSessionRevocationIsDurable,
    sdk_event_webhook_atomic_outbox_is_durable: sdkEventWebhookAtomicOutboxIsDurable,
    vault_artifact_status_bridge_is_durable: vaultArtifactStatusBridgeIsDurable,
    tenant_vault_audited_download_is_durable: tenantVaultAuditedDownloadIsDurable,
    supplier_non_sun_qa_evidence_is_durable: supplierNonSunQaEvidenceIsDurable,
    supplier_order_lifecycle_is_durable: supplierOrderLifecycleIsDurable,
    packaging_lab_foundation_is_durable: packagingLabFoundationIsDurable,
    webhook_delivery_identity_bridge_is_durable: webhookDeliveryIdentityBridgeIsDurable,
    enterprise_event_profile_is_durable: enterpriseEventProfileIsDurable,
    sun_carrier_trust_state_is_durable: sunCarrierTrustStateIsDurable,
    supplier_carrier_key_scope_is_durable: supplierCarrierKeyScopeIsDurable,
    vault_artifact_canonical_bridge_is_durable: vaultArtifactCanonicalBridgeIsDurable,
    supplier_keyless_qa_activation_is_durable: supplierKeylessQaActivationIsDurable,
    supplier_carrier_scope_integrity_is_durable: supplierCarrierScopeIntegrityIsDurable,
    sun_tt_durable_truth_is_durable: sunTtDurableTruthIsDurable,
    sun_runtime_acl_boundary_is_durable: sunRuntimeAclBoundaryIsDurable,
    sun_tt_conflict_target_is_durable: sunTtConflictTargetIsDurable,
    enterprise_rbac_risk_truth_is_durable: enterpriseRbacRiskTruthIsDurable,
    sun_demo_replay_isolation_is_durable: sunDemoReplayIsolationIsDurable,
    tenant_api_keys_clean_order_safe: tenantApiKeysCleanOrderSafe,
    partitioned_event_references_are_composite_safe: partitionedEventReferencesAreCompositeSafe,
    postgres_text_null_delimiter_free: postgresTextNullDelimiterFree,
    executor_matches_durable_state_machine: executorMatchesDurableStateMachine,
    runner_owns_transaction_boundary: checks.every((item) => !item.hasExplicitTransactionControl),
    runner_is_atomic_and_sparse_ledger_safe: runnerIsAtomic,
    unauthorized_clean_bootstrap_fails_closed: unauthorizedCleanBootstrapFailsClosed,
    legacy_v2_bypass_blocked: legacyBypassBlocked,
  },
}));
process.exitCode = ok ? 0 : 1;
