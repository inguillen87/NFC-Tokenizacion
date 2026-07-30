import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  hasSupplierKeyRotationV2,
  rotateSupplierBatchKeysV2,
  SUPPLIER_KEY_ROTATION_V2_MIGRATION,
  supplierKeyRotationError,
} from "../src/lib/supplier-key-rotation.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function readWorkspaceFile(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

function rotationInput() {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    supplierSubBatchId: "33333333-3333-4333-8333-333333333333",
    batchId: "44444444-4444-4444-8444-444444444444",
    bid: "SYN-2026-001",
    expectedTenantSlug: "syngenta",
    expectedPairId: "55555555-5555-4555-8555-555555555555",
    expectedPairVersion: 1,
    expectedPairFingerprint: "AAAABBBBCCCCDDDD",
    expectedMetaKeyFingerprint: "AAAAAAAAAAAAAAAA",
    expectedFileKeyFingerprint: "BBBBBBBBBBBBBBBB",
    nextKeyVersion: 2,
    newPairFingerprint: "1111222233334444",
    metaEncryptedKeyCt: "nexid-app-envelope-v2.meta.ciphertext",
    fileEncryptedKeyCt: "nexid-app-envelope-v2.file.ciphertext",
    metaKeyFingerprint: "5555666677778888",
    fileKeyFingerprint: "9999AAAABBBBCCCC",
    actorId: "66666666-6666-4666-8666-666666666666",
    actorEmail: "operator@nexid.lat",
    rotationReason: "Scheduled pre-export key rotation",
    userAgent: "test",
    requestId: "request-rotation-1",
  };
}

function rotationReceiptRow(overrides = {}) {
  const input = rotationInput();
  return {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    previous_key_version: input.expectedPairVersion,
    new_key_version: input.nextKeyVersion,
    previous_pair_fingerprint: input.expectedPairFingerprint,
    previous_role_fingerprints: {
      K_META_BATCH: input.expectedMetaKeyFingerprint,
      K_FILE_BATCH: input.expectedFileKeyFingerprint,
    },
    new_pair_fingerprint: input.newPairFingerprint,
    new_role_fingerprints: {
      K_META_BATCH: input.metaKeyFingerprint,
      K_FILE_BATCH: input.fileKeyFingerprint,
    },
    evidence_event_hash: `sha256:${"a".repeat(64)}`,
    rotated_material_count: 2,
    inserted_material_count: 2,
    updated_pair_count: 1,
    updated_batch_count: 1,
    updated_sub_batch_count: 1,
    ...overrides,
  };
}

test("supplier key rotation helper performs exactly one transactional writer call and validates 2/2/1/1/1", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [rotationReceiptRow()];
  };

  const receipt = await rotateSupplierBatchKeysV2(rotationInput(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /FROM public\.nexid_rotate_supplier_batch_keys_v2\(\?::jsonb\)/);
  assert.equal(calls[0].values.length, 1);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.expected_pair_version, 1);
  assert.equal(payload.next_key_version, 2);
  assert.equal(payload.expected_meta_key_fingerprint, rotationInput().expectedMetaKeyFingerprint);
  assert.equal(payload.expected_file_key_fingerprint, rotationInput().expectedFileKeyFingerprint);
  assert.equal("k_meta_hex" in payload, false);
  assert.equal("k_file_hex" in payload, false);
  assert.deepEqual(receipt.counts, {
    rotatedMaterial: 2,
    insertedMaterial: 2,
    updatedPair: 1,
    updatedBatch: 1,
    updatedSubBatch: 1,
  });

  await assert.rejects(
    rotateSupplierBatchKeysV2(rotationInput(), async () => [rotationReceiptRow({ updated_sub_batch_count: 0 })]),
    /supplier_key_rotation_readback_invalid/,
  );
  await assert.rejects(
    rotateSupplierBatchKeysV2(rotationInput(), async () => [rotationReceiptRow({
      new_pair_fingerprint: "FFFFEEEEDDDDCCCC",
    })]),
    /supplier_key_rotation_readback_invalid/,
  );
  await assert.rejects(
    rotateSupplierBatchKeysV2(rotationInput(), async () => [rotationReceiptRow({
      new_role_fingerprints: {
        K_META_BATCH: rotationInput().metaKeyFingerprint,
        K_FILE_BATCH: "FFFFEEEEDDDDCCCC",
      },
    })]),
    /supplier_key_rotation_readback_invalid/,
  );
  await assert.rejects(
    rotateSupplierBatchKeysV2(rotationInput(), async () => [rotationReceiptRow({
      evidence_event_hash: "not-a-sha256",
    })]),
    /supplier_key_rotation_readback_invalid/,
  );
});

test("supplier key rotation capability probe is safe before 0074", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ available: false }];
  };
  assert.equal(await hasSupplierKeyRotationV2(query), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_rotate_supplier_batch_keys_v2\(jsonb\)'\)/);
  assert.match(calls[0].statement, /has_function_privilege/);
  assert.match(calls[0].statement, /nexid_supplier_key_rotation_v2_capability/);
  assert.doesNotMatch(calls[0].statement, /FROM\s+supplier_sub_batches/i);
});

test("0074 owns compatible locks, post-lock gates and all-or-nothing projections", () => {
  const migration = readWorkspaceFile(`apps/api/db/migrations/${SUPPLIER_KEY_ROTATION_V2_MIGRATION}`);
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/keys/rotate/route.ts");
  const helper = readWorkspaceFile("apps/api/src/lib/supplier-key-rotation.ts");

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_supplier_key_rotation_v2_capability\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_rotate_supplier_batch_keys_v2\(p_input jsonb\)/);
  assert.match(migration, /supplier-pack-purpose[\s\S]*FOR UPDATE OF ssb, so, b, bk[\s\S]*FOR UPDATE OF bkm/);
  assert.ok(
    migration.indexOf("FOR UPDATE OF ssb, so, b, bk") < migration.indexOf("supplier_key_rotation_qa_passed"),
    "QA and export gates must be re-evaluated after authoritative row locks",
  );
  assert.match(migration, /v_locked\.qa_status = 'passed'/);
  assert.match(migration, /v_locked\.key_export_count <> 0 OR v_locked\.pair_export_count <> 0/);
  assert.match(migration, /v_locked\.manifest_status = 'imported' OR v_locked\.manifest_count <> 0/);
  assert.match(migration, /v_new_pair_fingerprint = v_expected_pair_fingerprint/);
  assert.match(migration, /v_meta_fingerprint = upper\(v_previous_role_fingerprints->>'K_META_BATCH'\)/);
  assert.match(migration, /v_file_fingerprint = upper\(v_previous_role_fingerprints->>'K_FILE_BATCH'\)/);
  assert.match(migration, /IF v_rotated_count <> 2/);
  assert.match(migration, /IF v_inserted_count <> 2/);
  assert.match(migration, /IF v_pair_count <> 1/);
  assert.match(migration, /IF v_batch_count <> 1/);
  assert.match(migration, /IF v_sub_batch_count <> 1/);
  assert.match(migration, /INSERT INTO evidence_events[\s\S]*INSERT INTO vault_artifacts[\s\S]*INSERT INTO audit_logs/);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(migration, /hsm_backed'\s*,\s*true|managed_kms'\s*,\s*true/i);
  assert.doesNotMatch(migration, /K_META\s*=|K_FILE\s*=/);

  assert.ok(
    route.indexOf("hasSupplierKeyRotationV2()") < route.indexOf("FROM supplier_orders so"),
    "rolling capability gate must precede the first schema-dependent read",
  );
  assert.equal((helper.match(/FROM public\.nexid_rotate_supplier_batch_keys_v2/g) || []).length, 1);
  assert.doesNotMatch(route, /UPDATE batch_key_material|INSERT INTO batch_key_material|UPDATE batch_keys|UPDATE batches|UPDATE supplier_sub_batches/);
  assert.match(route, /assertBatchKeyEnvelopeContext/);
  assert.doesNotMatch(route, /decryptBatchKeyHex|decryptKey16/);
});

test("supplier key rotation database failures are normalized without SQL or secrets", () => {
  assert.deepEqual(
    supplierKeyRotationError(Object.assign(new Error("supplier_key_rotation_qa_passed"), { code: "55000" })),
    { status: 409, reason: "supplier_key_rotation_qa_passed" },
  );
  assert.deepEqual(
    supplierKeyRotationError(Object.assign(new Error("function public.nexid_rotate_supplier_batch_keys_v2(jsonb) does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_key_rotation_v2_migration_required",
      requiredMigration: SUPPLIER_KEY_ROTATION_V2_MIGRATION,
    },
  );
  assert.deepEqual(
    supplierKeyRotationError(Object.assign(new Error("permission denied for function nexid_rotate_supplier_batch_keys_v2"), { code: "42501" })),
    { status: 503, reason: "supplier_key_rotation_runtime_grant_required" },
  );
  assert.deepEqual(
    supplierKeyRotationError(Object.assign(new Error("supplier_key_rotation_tenant_scope_mismatch"), { code: "42501" })),
    { status: 403, reason: "supplier_key_rotation_tenant_scope_mismatch" },
  );
  assert.deepEqual(
    supplierKeyRotationError(new Error("password=must-not-leak host=internal")),
    { status: 503, reason: "supplier_key_rotation_unavailable" },
  );
});
