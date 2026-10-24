import assert from "node:assert/strict";
import test from "node:test";
import {
  offlineVerifierBundleSchema,
  offlineVerifierSyncResponseSchema,
  supplierActivationResponseSchema,
  supplierKeyRotationResponseSchema,
  supplierManifestResponseSchema,
  supplierVaultArtifactSchema,
} from "../../../packages/api-client/src/index.ts";

// Validate the shared SDK contracts against the corrected Zod major.
// Import real contracts only. No transport, credentials, private keys or providers.
const artifact = { id: "artifact-qa", artifact_type: "qa" };
const manifest = { ok: true, batch: "batch-qa", importedRows: 1 };
const rotation = { ok: true, bid: "batch-qa", key_version: 1, key_fingerprint: "qa-fingerprint" };
const activation = { ok: true, batch: "batch-qa", activated: 1, remainingInactive: 0, activationComplete: true };
const bundle = () => ({
  id: "bundle-qa",
  bundle_ref: "bundle-qa",
  tenant_slug: "tenant-qa",
  device_id: "device-qa",
  allowed_bids: ["batch-qa"],
  key_fingerprints: {
    "batch:qa/1": {
      pair: null,
      roles: { "role:qa-v1": "qa-role-fingerprint" },
      future_descriptor: { public: true },
    },
  },
  key_material_included: false,
  policy: {
    contains_key_material: false,
    local_verdict_model: "provisional_until_backend_sync",
    allowed_local_verdicts: ["OFFLINE_LOCAL_PASS", "SYNC_PENDING"],
    requires_backend_sync_for: ["final_verdict"],
  },
  bundle_hash: "qa-bundle-fingerprint",
  status: "issued",
  expires_at: "2026-10-25T00:00:00.000Z",
  created_at: "2026-10-24T00:00:00.000Z",
});

test("real response schemas preserve extra fields and existing nullable or omitted fields", () => {
  const parsed = supplierVaultArtifactSchema.parse({
    ...artifact, bid: null, mime_type: null, status: null, future_field: { visible: true },
  });
  assert.equal(parsed.bid, null);
  assert.equal(parsed.mime_type, null);
  assert.equal(parsed.status, null);
  assert.deepEqual(parsed.future_field, { visible: true });
  assert.equal(Object.hasOwn(parsed, "metadata"), false);
  assert.equal(supplierManifestResponseSchema.parse({ ...manifest, supplier_gate: null }).supplier_gate, null);
  assert.equal(supplierActivationResponseSchema.parse({ ...activation, supplier_gate: null }).supplier_gate, null);
  assert.equal(Object.hasOwn(supplierManifestResponseSchema.parse(manifest), "supplier_gate"), false);
});

test("all six real records accept arbitrary string keys and preserve their value contracts", () => {
  const unknownValues = { "qa:key/1": { nested: [1, true, null] }, "qa key 2": null };
  assert.deepEqual(supplierVaultArtifactSchema.parse({ ...artifact, metadata: unknownValues }).metadata, unknownValues);
  assert.deepEqual(supplierManifestResponseSchema.parse({ ...manifest, supplier_gate: unknownValues }).supplier_gate, unknownValues);
  assert.deepEqual(supplierActivationResponseSchema.parse({ ...activation, supplier_gate: unknownValues }).supplier_gate, unknownValues);
  const roles = { "qa:role/1": "qa-fingerprint" };
  assert.deepEqual(supplierKeyRotationResponseSchema.parse({ ...rotation, role_key_fingerprints: roles }).role_key_fingerprints, roles);
  const input = bundle();
  assert.deepEqual(offlineVerifierBundleSchema.parse(input).key_fingerprints, input.key_fingerprints);
  assert.equal(offlineVerifierBundleSchema.parse({ ...input, key_fingerprints: {} }).key_material_included, false);
});

test("real contracts reject malformed records and retain provisional-only safety literals", () => {
  assert.equal(supplierVaultArtifactSchema.safeParse({ ...artifact, metadata: [] }).success, false);
  assert.equal(supplierKeyRotationResponseSchema.safeParse({ ...rotation, role_key_fingerprints: { role: 42 } }).success, false);
  assert.equal(offlineVerifierBundleSchema.safeParse({ ...bundle(), key_fingerprints: { batch: "invalid-descriptor" } }).success, false);
  assert.equal(offlineVerifierBundleSchema.safeParse({ ...bundle(), key_fingerprints: { batch: { roles: { role: 42 } } } }).success, false);
  assert.equal(offlineVerifierBundleSchema.safeParse({ ...bundle(), key_material_included: true }).success, false);
  assert.equal(offlineVerifierBundleSchema.safeParse({ ...bundle(), policy: { ...bundle().policy, contains_key_material: true } }).success, false);
  assert.equal(offlineVerifierSyncResponseSchema.safeParse({
    ok: true, bundle_ref: "bundle-qa", tenant_slug: "tenant-qa", received: 0, rejected: 0, final_verdict: true, results: [],
  }).success, false);
});
