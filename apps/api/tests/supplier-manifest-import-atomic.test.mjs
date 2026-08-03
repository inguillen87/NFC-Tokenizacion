import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  hasSupplierManifestImportV2,
  importTagManifestV2,
  SUPPLIER_MANIFEST_IMPORT_V2_BASE_MIGRATION,
  SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
  supplierManifestImportError,
} from "../src/lib/supplier-manifest-import.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const UUIDS = {
  tenant: "11111111-1111-4111-8111-111111111111",
  order: "22222222-2222-4222-8222-222222222222",
  subBatch: "33333333-3333-4333-8333-333333333333",
  batch: "44444444-4444-4444-8444-444444444444",
  actor: "55555555-5555-4555-8555-555555555555",
  session: "66666666-6666-4666-8666-666666666666",
  manifest: "77777777-7777-4777-8777-777777777777",
};

function readWorkspaceFile(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

function importInput() {
  return {
    tenantId: UUIDS.tenant,
    batchId: UUIDS.batch,
    bid: "SYN-2026-001",
    carrierProfileCode: "ntag424_dna_tt",
    manifestType: "csv",
    contentHash: `sha256:${"a".repeat(64)}`,
    activateImported: false,
    supplierOrderId: UUIDS.order,
    supplierSubBatchId: UUIDS.subBatch,
    expectedQuantity: 1,
    quantityOverride: null,
    actorId: UUIDS.actor,
    authSessionId: UUIDS.session,
    requestId: "manifest-request-1",
    userAgent: "test",
    rows: [{
      uidHex: "0487856A0B1090",
      carrierProfileCode: "ntag424_dna_tt",
      profile: null,
      sunPayload: {
        raw_url_hash: `sha256:${"1".repeat(64)}`,
        picc_data_hash: `sha256:${"2".repeat(64)}`,
        enc_hash: `sha256:${"3".repeat(64)}`,
        cmac_hash: `sha256:${"4".repeat(64)}`,
      },
    }],
  };
}

test("manifest helper commits through one writer and validates the receipt", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      manifest_id: UUIDS.manifest,
      inserted_count: 1,
      reactivated_count: 0,
      registered_sun_payload_count: 1,
      evidence_event_hashes: [`sha256:${"b".repeat(64)}`, `sha256:${"c".repeat(64)}`],
    }];
  };
  const result = await importTagManifestV2(importInput(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /FROM public\.nexid_import_tag_manifest_v2\(\?::jsonb\)/);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.actor_id, UUIDS.actor);
  assert.equal(payload.auth_session_id, UUIDS.session);
  assert.equal(payload.rows[0].uid_hex, "0487856A0B1090");
  assert.equal(payload.rows[0].sun_payload.picc_data_hash, importInput().rows[0].sunPayload.picc_data_hash);
  assert.equal("raw_payload" in payload.rows[0].sun_payload, false);
  assert.equal("k_meta" in payload, false);
  assert.equal("k_file" in payload, false);
  assert.equal(result.inserted, 1);

  await assert.rejects(
    importTagManifestV2(importInput(), async () => [{
      manifest_id: UUIDS.manifest,
      inserted_count: 2,
      reactivated_count: 0,
      registered_sun_payload_count: 1,
      evidence_event_hashes: [`sha256:${"b".repeat(64)}`, `sha256:${"c".repeat(64)}`],
    }]),
    /supplier_manifest_import_readback_invalid/,
  );

  await assert.rejects(
    importTagManifestV2(importInput(), async () => [{
      manifest_id: UUIDS.manifest,
      inserted_count: 1,
      reactivated_count: 0,
      registered_sun_payload_count: 0,
      evidence_event_hashes: [`sha256:${"b".repeat(64)}`, `sha256:${"c".repeat(64)}`],
    }]),
    /supplier_manifest_import_readback_invalid/,
  );
});

test("manifest capability probe is catalog-only and requires the global UID index", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ available: false }];
  };
  assert.equal(await hasSupplierManifestImportV2(query), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_import_tag_manifest_v2\(jsonb\)'\)/);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_supplier_carrier_scope_integrity_v1_capability\(\)'\)/);
  assert.match(calls[0].statement, /has_function_privilege\([\s\S]*nexid_supplier_carrier_scope_integrity_v1_capability/);
  assert.match(calls[0].statement, /to_regclass\('public\.uq_tags_uid_hex_global'\)/);
  assert.doesNotMatch(calls[0].statement, /FROM\s+tags/i);
});

test("0081 makes physical UID ownership global and manifest success all-or-nothing", () => {
  const migration = readWorkspaceFile(`apps/api/db/migrations/${SUPPLIER_MANIFEST_IMPORT_V2_BASE_MIGRATION}`);
  const route = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/import-manifest/route.ts");
  const registry = readWorkspaceFile("apps/api/src/lib/sun-payload-registry.ts");
  const registrationRoute = readWorkspaceFile("apps/api/src/app/admin/sun/register-payload/route.ts");
  const atomicSuccess = route.slice(route.indexOf("const atomicRows"));

  assert.match(migration, /tag_uid_global_uniqueness_preflight_failed/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global\s+ON tags \(upper\(trim\(uid_hex\)\)\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_import_tag_manifest_v2\(p_input jsonb\)/);
  assert.match(migration, /nexid_jsonb_contains_secret_key_v1\(manifest_row\.value\)/);
  assert.match(migration, /seed_\?phrase/);
  assert.doesNotMatch(migration, /\|seed\|/);
  assert.match(route, /seed_\?phrase/);
  assert.doesNotMatch(route, /\|seed\|/);
  assert.match(migration, /supplier_manifest_row_projection_invalid/);
  assert.match(migration, /supplier_manifest_sun_payload_duplicate/);
  assert.match(migration, /supplier_manifest_sun_binding_conflict/);
  assert.match(migration, /raw_values_persisted', false/);
  assert.doesNotMatch(migration, /v_sun->'raw_payload'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*'physical-tag-uid'/);
  assert.ok(
    migration.indexOf("'physical-tag-uid'") < migration.indexOf("supplier_manifest_global_uid_duplicate"),
    "global UID ownership must be checked after deterministic UID locks",
  );
  assert.match(migration, /FOR UPDATE OF batch/);
  assert.match(migration, /FOR UPDATE OF sub_batch, supplier_order/);
  assert.match(migration, /auth_session\.role::text = 'super_admin'[\s\S]*supplier_manifest_quantity_override_forbidden/);
  assert.match(migration, /INSERT INTO tags[\s\S]*INSERT INTO tenant_manifests[\s\S]*UPDATE supplier_sub_batches[\s\S]*INSERT INTO vault_artifacts[\s\S]*INSERT INTO evidence_events[\s\S]*INSERT INTO audit_logs/);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(migration, /hsm_backed'\s*,\s*true|managed_kms'\s*,\s*true/i);

  assert.ok(route.indexOf("hasSupplierManifestImportV2()") < route.indexOf("ensureCarrierProfileSchema()"));
  assert.match(route, /MAX_MANIFEST_BODY_BYTES = 16 \* 1024 \* 1024/);
  assert.match(route, /RequestBodyTooLargeError/);
  assert.equal((atomicSuccess.match(/importTagManifestV2\(/g) || []).length, 1);
  assert.doesNotMatch(atomicSuccess, /INSERT INTO tags|UPDATE supplier_sub_batches|INSERT INTO vault_artifacts|INSERT INTO evidence_events/);
  assert.match(route, /supplier_manifest_sensitive_columns_forbidden/);
  assert.match(route, /\[REDACTED_SUN_PAYLOAD\]/);
  assert.doesNotMatch(atomicSuccess, /raw:\s*row\.raw|sun_payload:\s*row\.sunPayload|manifest:\s*row\.raw/);

  assert.match(registry, /WHERE tag_sun_payloads\.tenant_id = EXCLUDED\.tenant_id/);
  assert.match(registry, /tag_sun_payloads\.tag_id = EXCLUDED\.tag_id/);
  assert.match(registry, /raw_values_persisted:\s*false/);
  assert.doesNotMatch(registry, /raw_payload = tag_sun_payloads\.raw_payload \|\| EXCLUDED\.raw_payload/);
  assert.match(registrationRoute, /sun_payload_binding_conflict/);
});

test("manifest failures preserve authority and redact database details", () => {
  assert.deepEqual(
    supplierManifestImportError(Object.assign(new Error("supplier_manifest_quantity_override_forbidden"), { code: "42501" })),
    { status: 403, reason: "supplier_manifest_quantity_override_forbidden" },
  );
  assert.deepEqual(
    supplierManifestImportError(Object.assign(new Error("supplier_manifest_global_uid_duplicate"), { code: "23505" })),
    { status: 409, reason: "supplier_manifest_global_uid_duplicate" },
  );
  assert.deepEqual(
    supplierManifestImportError(Object.assign(new Error("function public.nexid_import_tag_manifest_v2(jsonb) does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_manifest_import_v2_migration_required",
      requiredMigration: SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
    },
  );
  assert.equal(
    SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
    "20260802270000_0092_supplier_carrier_scope_integrity.sql",
  );
  assert.equal(
    SUPPLIER_MANIFEST_IMPORT_V2_BASE_MIGRATION,
    "20260802160000_0081_supplier_manifest_atomic_import.sql",
  );
  assert.deepEqual(
    supplierManifestImportError(new Error("password=must-not-leak host=internal")),
    { status: 503, reason: "supplier_manifest_import_v2_unavailable" },
  );
});
