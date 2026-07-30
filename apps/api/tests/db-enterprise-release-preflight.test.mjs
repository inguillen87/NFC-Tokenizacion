import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EnterpriseReleasePreflightError,
  expectedMigrations,
  runEnterpriseReleasePreflight,
  validateSdkIdempotencyKeyring,
} from "../scripts/db-enterprise-release-preflight.mjs";

const validKey = "a5".repeat(32);

test("enterprise release gate requires the reviewed ordered set through 0074", () => {
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
  ]);
});

test("migration safety gate covers 0061-0074 and the historical clean-order boundaries", () => {
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const script = fileURLToPath(new URL("../../../scripts/check-migration-safety.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.ok, true);
  assert.deepEqual(report.migrations.slice(-14).map(({ id }) => id), [
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
        return { rows: [{
          database_name: "nexid_test",
          has_migration_ledger: true,
          has_webhook_endpoints: true,
          has_marketplace_products: true,
          has_marketplace_brand_profiles: true,
          has_marketplace_runtime_baseline: true,
          has_sdk_idempotency_operations: true,
          has_vault_artifacts: true,
          has_supplier_export_envelope: true,
          has_sun_atomic_persistence: true,
          has_sun_casefold_uid_guard: true,
          has_supplier_packaging_governance: true,
          has_supplier_packaging_governance_writer: true,
          has_webhook_lifecycle_audit: true,
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
          has_supplier_key_rotation_v2_writer: true,
          has_supplier_key_rotation_v2_capability: true,
          can_rotate_supplier_batch_keys_v2: true,
          can_probe_supplier_key_rotation_v2: true,
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
      env: { DATABASE_URL: "postgres://unused", SDK_IDEMPOTENCY_MASTER_KEY_HEX: validKey },
      Client: MissingMigrationClient,
    }),
    (error) => error instanceof EnterpriseReleasePreflightError
      && error.reason === "required_migrations_missing"
      && error.details.missing_migrations.includes("20260730150000_0074_supplier_key_rotation_atomic.sql"),
  );
  assert.equal(ended, true);
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
