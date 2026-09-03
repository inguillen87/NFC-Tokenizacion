import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EnterpriseReleasePreflightError,
  expectedMigrations,
  runEnterpriseReleasePreflight,
  validateExpectedRuntimeDatabaseRole,
  validateSdkIdempotencyKeyring,
} from "../scripts/db-enterprise-release-preflight.mjs";

const validKey = "a5".repeat(32);
const runtimeRole = "nexid_runtime";

test("enterprise release preflight pins the expected non-secret runtime database role", () => {
  assert.equal(validateExpectedRuntimeDatabaseRole({ NEXID_RUNTIME_DB_ROLE: runtimeRole }), runtimeRole);
  assert.throws(
    () => validateExpectedRuntimeDatabaseRole({}),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "runtime_database_role_required",
  );
  assert.throws(
    () => validateExpectedRuntimeDatabaseRole({ NEXID_RUNTIME_DB_ROLE: "x".repeat(64) }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "runtime_database_role_invalid",
  );
});

test("enterprise release gate requires the reviewed ordered set through 0100", () => {
  assert.deepEqual(expectedMigrations, [
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
    "20260802190000_0084_tenant_vault_audited_download.sql",
    "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
    "20260802210000_0086_supplier_order_lifecycle.sql",
    "20260802220000_0087_packaging_lab_foundation.sql",
    "20260802230000_0088_enterprise_event_profile.sql",
    "20260802240000_0089_sun_carrier_trust_state.sql",
    "20260802250000_0090_supplier_carrier_key_scope.sql",
    "20260802260000_0091_supplier_keyless_qa_activation.sql",
    "20260802270000_0092_supplier_carrier_scope_integrity.sql",
    "20260802280000_0093_sun_tt_durable_truth_binding.sql",
    "20260802290000_0094_sun_runtime_acl_boundary.sql",
    "20260802300000_0095_sun_tt_conflict_target.sql",
    "20260802310000_0096_enterprise_rbac_risk_truth.sql",
    "20260829120000_0097_public_location_privacy.sql",
    "20260830120000_0098_event_location_context.sql",
    "20260831190000_0099_post_tap_location_observation.sql",
    "20260903110000_0099_commercial_role_defaults.sql",
    "20260903120000_0100_event_incident_optimistic_concurrency.sql",
  ]);
});

test("migration safety gate covers 0061-0100 and the historical clean-order boundaries", () => {
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const script = fileURLToPath(new URL("../../../scripts/check-migration-safety.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.ok, true);
  const reviewedStart = report.migrations.findIndex(({ id }) => id === "20260726190000_0061_supplier_export_artifact_delivery.sql");
  assert.notEqual(reviewedStart, -1);
  assert.deepEqual(report.migrations.slice(reviewedStart).map(({ id }) => id), [
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
    "20260802190000_0084_tenant_vault_audited_download.sql",
    "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
    "20260802210000_0086_supplier_order_lifecycle.sql",
    "20260802220000_0087_packaging_lab_foundation.sql",
    "20260802230000_0088_enterprise_event_profile.sql",
    "20260802240000_0089_sun_carrier_trust_state.sql",
    "20260802250000_0090_supplier_carrier_key_scope.sql",
    "20260802260000_0091_supplier_keyless_qa_activation.sql",
    "20260802270000_0092_supplier_carrier_scope_integrity.sql",
    "20260802280000_0093_sun_tt_durable_truth_binding.sql",
    "20260802290000_0094_sun_runtime_acl_boundary.sql",
    "20260802300000_0095_sun_tt_conflict_target.sql",
    "20260802310000_0096_enterprise_rbac_risk_truth.sql",
    "20260829120000_0097_public_location_privacy.sql",
    "20260830120000_0098_event_location_context.sql",
    "20260831190000_0099_post_tap_location_observation.sql",
    "20260903110000_0099_commercial_role_defaults.sql",
    "20260903120000_0100_event_incident_optimistic_concurrency.sql",
  ]);
  assert.equal(report.assertions.tenant_api_keys_clean_order_safe, true);
  assert.equal(report.assertions.sdk_idempotency_schema_is_durable, true);
  assert.equal(report.assertions.supplier_export_envelope_is_durable, true);
  assert.equal(report.assertions.sun_atomic_persistence_is_durable, true);
  assert.equal(report.assertions.supplier_packaging_governance_is_durable, true);
  assert.equal(report.assertions.webhook_lifecycle_governance_is_durable, true);
  assert.equal(report.assertions.event_incident_workflow_is_durable, true);
  assert.equal(report.assertions.tag_lifecycle_governance_is_durable, true);
  assert.equal(report.assertions.canonical_event_outbox_is_durable, true);
  assert.equal(report.assertions.gs1_epcis_foundation_is_durable, true);
  assert.equal(report.assertions.supplier_qa_atomic_commit_is_durable, true);
  assert.equal(report.assertions.supplier_pack_purpose_governance_is_durable, true);
  assert.equal(report.assertions.marketplace_runtime_baseline_is_durable, true);
  assert.equal(report.assertions.tokenization_marketplace_execution_governance_is_durable, true);
  assert.equal(report.assertions.supplier_qa_verification_context_v2_is_durable, true);
  assert.equal(report.assertions.supplier_key_rotation_v2_is_durable, true);
  assert.equal(report.assertions.supplier_production_qa_acceptance_v2_is_durable, true);
  assert.equal(report.assertions.supplier_production_activation_v2_is_durable, true);
  assert.equal(report.assertions.tenant_api_key_lifecycle_v1_is_durable, true);
  assert.equal(report.assertions.webhook_destination_cutover_v1_is_durable, true);
  assert.equal(report.assertions.supplier_order_atomic_create_v2_is_durable, true);
  assert.equal(report.assertions.offline_scan_history_index_is_durable, true);
  assert.equal(report.assertions.supplier_manifest_atomic_import_v2_is_durable, true);
  assert.equal(report.assertions.consumer_session_revocation_is_durable, true);
  assert.equal(report.assertions.sdk_event_webhook_atomic_outbox_is_durable, true);
  assert.equal(report.assertions.tenant_vault_audited_download_is_durable, true);
  assert.equal(report.assertions.supplier_non_sun_qa_evidence_is_durable, true);
  assert.equal(report.assertions.supplier_order_lifecycle_is_durable, true);
  assert.equal(report.assertions.supplier_carrier_key_scope_is_durable, true);
  assert.equal(report.assertions.sun_runtime_acl_boundary_is_durable, true);
  assert.equal(report.assertions.sun_tt_conflict_target_is_durable, true);
  assert.equal(report.assertions.enterprise_rbac_risk_truth_is_durable, true);
  assert.equal(report.assertions.public_location_privacy_is_additive, true);
  assert.equal(report.assertions.event_location_context_columns_are_additive, true);
  assert.equal(report.assertions.post_tap_location_observation_is_additive, true);
  assert.equal(report.assertions.commercial_role_defaults_are_forward_only, true);
  assert.equal(report.assertions.unauthorized_clean_bootstrap_fails_closed, true);
});

test("SDK replay keyring validation is strict and returns only non-secret metadata", () => {
  assert.throws(
    () => validateSdkIdempotencyKeyring({}),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "sdk_idempotency_master_key_invalid",
  );
  assert.throws(
    () => validateSdkIdempotencyKeyring({ SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey, SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON: "[]" }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "sdk_idempotency_previous_keys_invalid",
  );

  const result = validateSdkIdempotencyKeyring({
    SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey,
    SDK_IDEMPOTENCY_MASTER_KEY_ID: "sdk_2026_08",
    SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON: JSON.stringify({ sdk_2026_07: "b6".repeat(32) }),
  });
  assert.deepEqual(result, {
    key_configured: true,
    active_key_id_explicit: true,
    previous_key_count: 1,
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(validKey, "i"));
});

test("enterprise release gate fails closed when any reviewed migration is absent", async () => {
  let ended = false;
  class MissingMigrationClient {
    async connect() {}
    async query(statement) {
      if (String(statement).includes("current_database()")) {
        assert.match(String(statement), /session_user::text AS session_database_role/);
        assert.match(
          String(statement),
          /current_setting\('server_version_num'\)::integer >= 160000[\s\S]*pg_has_role\(current_user, reachable_sensitive_role\.oid, 'SET'\)[\s\S]*pg_has_role\(current_user, reachable_sensitive_role\.oid, 'MEMBER'\)/,
        );
        assert.match(
          String(statement),
          /reachable_sensitive_role\.rolsuper[\s\S]*reachable_sensitive_role\.rolbypassrls[\s\S]*reachable_sensitive_role\.rolcreaterole[\s\S]*reachable_sensitive_role\.rolcreatedb[\s\S]*reachable_sensitive_role\.rolreplication/,
        );
        assert.doesNotMatch(
          String(statement),
          /pg_has_role\(current_user, (?:private_routine\.proowner|private_relation\.relowner), 'USAGE'\)/,
        );
        assert.match(
          String(statement),
          /NOT historical_routine\.prosecdef[\s\S]*wrapper_routine\.proowner = base_routine\.proowner[\s\S]*wrapper_routine\.proowner = historical_routine\.proowner[\s\S]*wrapper_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\][\s\S]*base_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\][\s\S]*historical_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\]/,
        );
        return { rows: [{
          database_name: "nexid_test",
          database_role: runtimeRole,
          session_database_role: runtimeRole,
          runtime_role_restricted: true,
          runtime_role_no_public_create: true,
          runtime_role_isolated_from_sensitive_roles: true,
          has_migration_ledger: true,
          has_event_location_context_columns: true,
          has_post_tap_location_observation: true,
          has_webhook_endpoints: true,
          has_marketplace_products: true,
          has_marketplace_brand_profiles: true,
          has_marketplace_runtime_baseline: true,
          has_sdk_idempotency_operations: true,
          has_tenant_api_key_lifecycle_receipts: true,
          has_tenant_api_key_lifecycle_capability: true,
          has_tenant_api_key_create_writer: true,
          has_tenant_api_key_mutation_writer: true,
          can_create_tenant_api_key: true,
          can_mutate_tenant_api_key: true,
          has_tenant_api_key_lifecycle_guard: true,
          has_tenant_api_key_receipt_append_only_trigger: true,
          has_tenant_api_key_status_constraint: true,
          has_vault_artifacts: true,
          has_supplier_export_envelope: true,
          has_tenant_vault_audited_download: true,
          can_record_tenant_vault_download: true,
          has_sun_atomic_persistence: true,
          has_sun_casefold_uid_guard: true,
          has_supplier_packaging_governance: true,
          has_supplier_packaging_governance_writer: true,
          has_webhook_lifecycle_audit: true,
          has_webhook_destination_versions: true,
          has_webhook_destination_cutover_functions: true,
          has_sdk_event_atomic_outbox_functions: true,
          can_use_sdk_event_atomic_outbox: true,
          has_supplier_order_atomic_create_functions: true,
          can_create_supplier_order_v2: true,
          has_supplier_carrier_key_scope: true,
          can_probe_supplier_order_keyless_v1: true,
          has_supplier_keyless_qa_activation: true,
          can_use_supplier_keyless_qa_activation: true,
          has_supplier_carrier_scope_integrity: true,
          can_use_supplier_carrier_scope_integrity: true,
          has_sun_tt_durable_truth: true,
          can_use_sun_tt_durable_truth: true,
          has_sun_runtime_acl_boundary: true,
          has_sun_tt_conflict_target: true,
          has_enterprise_rbac_risk_truth: true,
          has_supplier_order_lifecycle: true,
          can_use_supplier_order_lifecycle: true,
          has_offline_scan_history_index: true,
          has_consumer_session_revocation: true,
          has_supplier_manifest_atomic_import: true,
          has_supplier_manifest_secret_scanners: true,
          can_import_supplier_manifest_v2: true,
          can_scan_supplier_manifest_secrets: true,
          has_event_incidents: true,
          has_event_incident_history: true,
          has_event_incident_open_writer: true,
          has_event_incident_transition_writer: true,
          has_tag_lifecycle_events: true,
          has_tag_lifecycle_writer: true,
          has_canonical_event_operations: true,
          has_canonical_event_writer: true,
          has_gs1_digital_link_identities: true,
          has_epcis_capture_operations: true,
          has_epcis_events: true,
          has_epcis_capture_writer: true,
          has_supplier_qa_diagnostic_consumptions: true,
          has_supplier_qa_atomic_writer: true,
          has_supplier_qa_verification_context_receipts: true,
          has_supplier_qa_verification_context_writer: true,
          has_supplier_qa_verification_context_capability: true,
          can_commit_supplier_qa_v2: true,
          can_canonicalize_supplier_qa_v2: true,
          can_write_supplier_qa_verification_context_receipts: true,
          has_supplier_carrier_qa: true,
          can_use_supplier_carrier_qa: true,
          has_supplier_key_rotation_v2_writer: true,
          has_supplier_key_rotation_v2_capability: true,
          can_rotate_supplier_batch_keys_v2: true,
          can_probe_supplier_key_rotation_v2: true,
          has_supplier_production_qa_manufacturing_state: true,
          has_supplier_production_qa_acceptance_tables: true,
          has_supplier_production_qa_acceptance_functions: true,
          can_use_supplier_production_qa_acceptance: true,
          has_supplier_production_activation_receipts: true,
          has_supplier_production_activation_receipt_function: true,
          has_supplier_production_activation_assert: true,
          has_supplier_order_commercial_release_guard: true,
          has_supplier_production_activation_writer: true,
          can_write_supplier_production_activation_receipts: true,
          can_resolve_supplier_production_activation_receipt: true,
          can_assert_supplier_production_activation: true,
          can_assert_supplier_order_commercial_release: true,
          can_activate_supplier_production_tags: true,
          has_supplier_production_activation_receipt_append_only_trigger: true,
          has_supplier_pack_purpose_decisions: true,
          has_supplier_pack_purpose_decision_items: true,
          has_supplier_commercial_release_guard: true,
          has_supplier_commercial_sink_guard: true,
          has_tokenization_execution_prepare: true,
          has_tokenization_asset_dedupe: true,
          has_tokenization_partition_event_identity: true,
          has_tokenization_marketplace_scope_triggers: true,
          can_prepare_tokenization_execution: true,
          can_assert_supplier_commercial_release: true,
          has_supplier_commercial_guard_triggers: true,
          has_canonical_source_partition_identity: true,
        }] };
      }
      return { rows: expectedMigrations.slice(0, -1).map((id) => ({ id })) };
    }
    async end() { ended = true; }
  }

  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingMigrationClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_migrations_missing"
      && error.details.missing_migrations.includes("20260903120000_0100_event_incident_optimistic_concurrency.sql"),
  );
  assert.equal(ended, true);

  class WrongRuntimeRoleClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].database_role = "migration_owner";
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: WrongRuntimeRoleClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "runtime_database_role_mismatch"
      && error.details.expected_role === runtimeRole
      && error.details.connected_role === "migration_owner"
      && error.details.session_role === runtimeRole,
  );

  class SetRoleDisguiseClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].session_database_role = "migration_owner";
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: SetRoleDisguiseClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "runtime_database_role_mismatch"
      && error.details.expected_role === runtimeRole
      && error.details.connected_role === runtimeRole
      && error.details.session_role === "migration_owner",
  );

  class PrivilegedRuntimeRoleClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].runtime_role_restricted = false;
        result.rows[0].runtime_role_no_public_create = false;
        result.rows[0].runtime_role_isolated_from_sensitive_roles = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: PrivilegedRuntimeRoleClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("runtime role cannot SET ROLE into dangerous or private-owner roles"),
  );

  class SunDefinerDriftClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].has_sun_runtime_acl_boundary = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: SunDefinerDriftClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("SUN runtime ACL boundary"),
  );

  class MissingActivationWriterClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].has_supplier_production_activation_writer = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingActivationWriterClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("nexid_activate_supplier_tags_v2(jsonb)"),
  );

  class MissingManifestScannerPrivilegeClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].can_scan_supplier_manifest_secrets = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingManifestScannerPrivilegeClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("EXECUTE supplier manifest recursive secret scanners"),
  );

  class MissingEnterpriseRbacRiskTruthClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].has_enterprise_rbac_risk_truth = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingEnterpriseRbacRiskTruthClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("enterprise RBAC and deterministic risk truth"),
  );

  class MissingEventLocationContextClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].has_event_location_context_columns = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingEventLocationContextClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("events location context columns"),
  );

  class MissingPostTapLocationObservationClient extends MissingMigrationClient {
    async query(statement) {
      const result = await super.query(statement);
      if (String(statement).includes("current_database()")) {
        result.rows[0].has_post_tap_location_observation = false;
      }
      return result;
    }
  }
  await assert.rejects(
    runEnterpriseReleasePreflight({
      env: { DATABASE_URL: "postgres://unused", NEXID_RUNTIME_DB_ROLE: runtimeRole, SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingPostTapLocationObservationClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_schema_missing"
      && error.details.missing_schema.includes("post-tap location observation"),
  );
});

test("CLI reports ok false without echoing an invalid secret or opening PostgreSQL", () => {
  const exposedCandidate = "this-must-never-be-printed";
  const script = fileURLToPath(new URL("../scripts/db-enterprise-release-preflight.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "postgres://must-not-connect",
      NEXID_RUNTIME_DB_ROLE: runtimeRole,
      SDK_IDEMPOTENCY_MASTER_KEY_HEX: exposedCandidate,
      SDK_IDEMPOTENCY_MASTER_KEY_ID: "sdk_test",
      SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON: "",
    },
  });

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /"ok":false/);
  assert.match(output, /sdk_idempotency_master_key_invalid/);
  assert.doesNotMatch(output, new RegExp(exposedCandidate));
});
