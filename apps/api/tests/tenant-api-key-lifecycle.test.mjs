import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../db/migrations/20260802113000_0077_tenant_api_key_lifecycle.sql", import.meta.url),
  "utf8",
);

test("0077 repairs legacy key rows before validating durable credential constraints", () => {
  const repair = migration.indexOf("UPDATE tenant_api_keys api_key");
  const constraints = migration.indexOf("ADD CONSTRAINT tenant_api_keys_key_hash_format_check");
  const validation = migration.indexOf("VALIDATE CONSTRAINT tenant_api_keys_key_hash_format_check");
  assert.ok(repair >= 0 && repair < constraints && constraints < validation);
  for (const constraint of [
    "tenant_api_keys_status_check",
    "tenant_api_keys_key_hash_format_check",
    "tenant_api_keys_key_prefix_format_check",
    "tenant_api_keys_name_check",
    "tenant_api_keys_scopes_check",
    "tenant_api_keys_metadata_object_check",
  ]) assert.match(migration, new RegExp(constraint));
  assert.match(migration, /ALTER COLUMN tenant_id SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN status SET NOT NULL/);
  assert.match(migration, /tenant_api_key_legacy_tenant_reconciliation_required/);
});

test("0077 serializes live quota and makes revocation terminal", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /api_key\.expires_at IS NULL OR api_key\.expires_at > now\(\)/);
  assert.match(migration, /tenant_api_key_reactivation_forbidden/);
  assert.match(migration, /tenant_api_key_identity_immutable/);
  assert.match(migration, /tenant_api_key_delete_forbidden/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_create_tenant_api_key_v1/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_mutate_tenant_api_key_v1/);
});

test("0077 lifecycle receipts are append-only and contain no key material", () => {
  const receiptTable = migration.slice(
    migration.indexOf("CREATE TABLE IF NOT EXISTS tenant_api_key_lifecycle_receipts"),
    migration.indexOf("CREATE INDEX IF NOT EXISTS idx_tenant_api_key_receipts_tenant_created"),
  );
  assert.doesNotMatch(receiptTable, /key_hash|raw_key|raw_secret|secret_ciphertext/i);
  assert.match(migration, /tenant_api_key_lifecycle_history_is_append_only/);
  assert.match(migration, /REVOKE ALL ON TABLE tenant_api_key_lifecycle_receipts FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_create_tenant_api_key_v1\(jsonb\) FROM PUBLIC/);
  assert.match(migration, /'key_hash_in_receipts', false/);
  assert.doesNotMatch(migration, /hsm[_ -]?backed\s*[:=]\s*true/i);
});

test("0077 preserves the 0069 referenced-key reparent guard", async () => {
  const migration69 = await readFile(
    new URL("../db/migrations/20260729110500_0069_gs1_epcis_foundation.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration69, /trg_epcis_referenced_api_key_reparent/);
  assert.doesNotMatch(migration, /DROP TRIGGER IF EXISTS trg_epcis_referenced_api_key_reparent/);
});
