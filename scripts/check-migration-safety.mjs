import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "apps/api/db/migrations");
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
];
const checks = [];
for (const id of ids) {
  const sql = await fs.readFile(path.join(root, id), "utf8");
  checks.push({
    id,
    bytes: Buffer.byteLength(sql),
    hasExplicitTransactionControl: /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql),
  });
}
const sql55 = await fs.readFile(path.join(root, "20260724213000_0055_iota_executor_durable_broadcast.sql"), "utf8");
const sql56 = await fs.readFile(path.join(root, "20260725014500_0056_iota_evidence_constraints_validate.sql"), "utf8");
const sql58 = await fs.readFile(path.join(root, "20260726103000_0058_webhook_signature_v2.sql"), "utf8");
const sql58Marketplace = await fs.readFile(path.join(root, "20260726120000_0058_marketplace_runtime_baseline.sql"), "utf8");
const sql60 = await fs.readFile(path.join(root, "20260726173000_0060_sdk_idempotency_operations.sql"), "utf8");
const sql61 = await fs.readFile(path.join(root, "20260726190000_0061_supplier_export_artifact_delivery.sql"), "utf8");
const sql62 = await fs.readFile(path.join(root, "20260728120000_0062_sun_atomic_persistence.sql"), "utf8");
const sql63 = await fs.readFile(path.join(root, "20260728143000_0063_supplier_packaging_governance.sql"), "utf8");
const sql64 = await fs.readFile(path.join(root, "20260728160000_0064_webhook_lifecycle_governance.sql"), "utf8");
const sql65 = await fs.readFile(path.join(root, "20260728173000_0065_event_incident_workflow.sql"), "utf8");
const sql66 = await fs.readFile(path.join(root, "20260728180000_0066_tag_lifecycle_governance.sql"), "utf8");
const sql67 = await fs.readFile(path.join(root, "20260728183000_0067_canonical_event_outbox.sql"), "utf8");
const sql68 = await fs.readFile(path.join(root, "20260729110000_0068_epcis_event_type.sql"), "utf8");
const sql69 = await fs.readFile(path.join(root, "20260729110500_0069_gs1_epcis_foundation.sql"), "utf8");
const sql70 = await fs.readFile(path.join(root, "20260729130000_0070_supplier_qa_atomic_receipts.sql"), "utf8");
const sql71 = await fs.readFile(path.join(root, "20260729143000_0071_supplier_pack_purpose_governance.sql"), "utf8");
const sql72 = await fs.readFile(path.join(root, "20260729160000_0072_tokenization_marketplace_execution_governance.sql"), "utf8");
const sql73 = await fs.readFile(path.join(root, "20260730110000_0073_supplier_qa_verification_context_v2.sql"), "utf8");
const sql74 = await fs.readFile(path.join(root, "20260730150000_0074_supplier_key_rotation_atomic.sql"), "utf8");
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

const allMigrationFiles = (await fs.readdir(root)).filter((file) => file.endsWith(".sql")).sort();
let tenantApiKeysMaterialized = false;
let tenantApiKeysCanonicalCreateFound = false;
let tenantApiKeysCleanOrderSafe = true;
let partitionedEventReferencesAreCompositeSafe = true;
let postgresTextNullDelimiterFree = true;
for (const file of allMigrationFiles) {
  const source = await fs.readFile(path.join(root, file), "utf8");
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
