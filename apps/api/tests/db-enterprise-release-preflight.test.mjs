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

test("enterprise release gate requires the reviewed ordered set through 0061", () => {
  assert.deepEqual(expectedMigrations, [
    "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
    "20260726103000_0058_webhook_signature_v2.sql",
    "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
    "20260726173000_0060_sdk_idempotency_operations.sql",
    "20260726190000_0061_supplier_export_artifact_delivery.sql",
  ]);
});

test("migration safety gate covers 0059-0061 and the historical 0040 clean-order boundary", () => {
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const script = fileURLToPath(new URL("../../../scripts/check-migration-safety.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.ok, true);
  assert.deepEqual(report.migrations.slice(-3).map(({ id }) => id), [
    "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
    "20260726173000_0060_sdk_idempotency_operations.sql",
    "20260726190000_0061_supplier_export_artifact_delivery.sql",
  ]);
  assert.equal(report.assertions.tenant_api_keys_clean_order_safe, true);
  assert.equal(report.assertions.sdk_idempotency_schema_is_durable, true);
  assert.equal(report.assertions.supplier_export_envelope_is_durable, true);
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
          has_sdk_idempotency_operations: true,
          has_vault_artifacts: true,
          has_supplier_export_envelope: true,
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
      && error.details.missing_migrations.includes("20260726190000_0061_supplier_export_artifact_delivery.sql"),
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
