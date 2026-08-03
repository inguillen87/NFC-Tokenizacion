import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  commitSupplierCarrierQa,
  hasSupplierCarrierQaV1,
  supplierCarrierQaCommitError,
} from "../src/lib/supplier-carrier-qa-commit.ts";
import { SUPPLIER_CARRIER_QA_MIGRATION } from "../src/lib/supplier-carrier-qa-evidence.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path) => readFileSync(`${repositoryRoot}/${path}`, "utf8");

function input() {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    supplierSubBatchId: "33333333-3333-4333-8333-333333333333",
    batchId: "44444444-4444-4444-8444-444444444444",
    bid: "SYN-2026-001",
    sampleCount: 1,
    notes: null,
    evidence: {
      schema_version: "supplier-qa-carrier/v1",
      evidence_digest: `sha256:${"a".repeat(64)}`,
    },
    evidenceDigest: `sha256:${"a".repeat(64)}`,
    receiptRows: [{
      tag_id: "55555555-5555-4555-8555-555555555555",
      carrier_profile_code: "ntag213",
      capture_method: "nfc_ndef",
      captured_at: "2026-08-02T17:00:00.000Z",
      uid_fingerprint: `sha256:${"b".repeat(64)}`,
      encoded_url_hash: `sha256:${"c".repeat(64)}`,
      target_binding: { kind: "nexid_static_nfc" },
      target_binding_digest: `sha256:${"d".repeat(64)}`,
      observation_digest: `sha256:${"e".repeat(64)}`,
      gs1_identity_id: null,
    }],
    operationKey: "qa-carrier-syn-001",
    actorId: "66666666-6666-4666-8666-666666666666",
    authSessionId: "77777777-7777-4777-8777-777777777778",
    actorEmail: "qa@nexid.lat",
    expectedManifestHash: `sha256:${"f".repeat(64)}`,
    expectedCarrierProfileCode: "ntag213",
    expectedKeyFingerprint: "",
    expectedSdmConfig: { profile: "enterprise_supplier_declared" },
    expectedVerificationContextDigest: `sha256:${"1".repeat(64)}`,
    expectedVerificationContextBinding: { schema_version: "v2" },
    expectedVerificationContextCanonical: '{"schema_version":"v2"}',
    userAgent: "test",
    requestId: "request-1",
  };
}

test("carrier QA commit uses one atomic database writer and never supplies SUN refs", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      qa_check_id: "77777777-7777-4777-8777-777777777777",
      qa_status: "passed",
      evidence_digest: `sha256:${"a".repeat(64)}`,
      evidence_event_hash: `sha256:${"9".repeat(64)}`,
      idempotent_replay: false,
    }];
  };
  const receipt = await commitSupplierCarrierQa(input(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /nexid_commit_supplier_carrier_qa_v1/);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.status, "passed");
  assert.equal(payload.replay_checked, false);
  assert.equal(payload.ttstatus_checked, false);
  assert.equal(payload.auth_session_id, "77777777-7777-4777-8777-777777777778");
  assert.equal(payload.expected_key_fingerprint, "");
  assert.equal(payload.carrier_evidence_rows.length, 1);
  assert.equal("diagnostic_refs" in payload, false);
  assert.equal("snapshot_urls" in payload, false);
  assert.equal(receipt.idempotentReplay, false);
});

test("carrier QA capability probe is rolling-safe", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ available: true }];
  };
  assert.equal(await hasSupplierCarrierQaV1(query), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_commit_supplier_carrier_qa_v1\(jsonb\)'\)/);
  assert.match(calls[0].statement, /nexid_supplier_keyless_qa_activation_v1_capability/);
  assert.match(calls[0].statement, /to_regclass\('public\.supplier_qa_carrier_evidence_receipts'\)/);
  assert.doesNotMatch(calls[0].statement, /FROM\s+supplier_qa_carrier_evidence_receipts/i);
});

test("carrier QA migration revalidates tenant, manifest, tag, GS1 and exact immutable context atomically", () => {
  const baseMigration = read("apps/api/db/migrations/20260802200000_0085_supplier_non_sun_qa_evidence.sql");
  const migration = read(`apps/api/db/migrations/${SUPPLIER_CARRIER_QA_MIGRATION}`);
  const route = read("apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts");
  assert.match(baseMigration, /CREATE TABLE IF NOT EXISTS supplier_qa_carrier_evidence_receipts/);
  assert.match(baseMigration, /BEFORE UPDATE OR DELETE ON supplier_qa_carrier_evidence_receipts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_keyless_production_qa_acceptance_receipts/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_keyless_production_qa_acceptance_receipts/);
  assert.match(migration, /supplier-keyless-qa-activation\/v1/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_commit_supplier_carrier_qa_v1\(p_input jsonb\)/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /nexid_packaging_lab_actor_authorized_v1/);
  assert.match(migration, /FOR UPDATE OF sub_batch, supplier_order, batch/);
  assert.match(migration, /FROM tags tag[\s\S]*FOR UPDATE/);
  assert.match(migration, /FROM gs1_digital_link_identities identity[\s\S]*FOR UPDATE OF identity/);
  assert.match(migration, /v_expected_context_binding IS DISTINCT FROM v_context_binding/);
  assert.match(migration, /batch_key_count <> 0/);
  assert.match(migration, /batch_key_material_count <> 0/);
  assert.match(migration, /key_material_mode', 'none'/);
  assert.match(migration, /software_envelope', false/);
  assert.match(migration, /metadata_json->>'software_envelope', ''\) <> 'false'/);
  assert.match(migration, /context_binding->>'software_envelope' = 'false'/);
  assert.match(migration, /managed_kms', false/);
  assert.match(migration, /hsm_backed', false/);
  assert.match(migration, /supplier_production_qa_plans/);
  assert.match(migration, /supplier_production_qa_plan_decisions/);
  assert.match(migration, /nexid_packaging_lab_activation_receipt_v1/);
  assert.match(migration, /server_verified_sun_evidence', false/);
  assert.match(migration, /cryptographic_authentication_verified', false/);
  assert.match(migration, /replay_checked', false/);
  assert.match(migration, /physical_ceremony_verified', false/);
  assert.match(migration, /supplier-carrier-qa-db-receipt\/v2/);
  assert.match(migration, /INSERT INTO supplier_qa_checks[\s\S]*INSERT INTO supplier_qa_verification_context_receipts[\s\S]*INSERT INTO supplier_qa_carrier_evidence_receipts[\s\S]*INSERT INTO supplier_keyless_production_qa_acceptance_receipts[\s\S]*INSERT INTO vault_artifacts[\s\S]*UPDATE supplier_sub_batches[\s\S]*UPDATE batches[\s\S]*INSERT INTO evidence_events[\s\S]*INSERT INTO audit_logs/);
  assert.match(migration, /RENAME TO nexid_supplier_sun_production_activation_receipt_v2/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_supplier_production_activation_receipt_v2/);
  assert.match(migration, /nexid_supplier_sun_production_activation_receipt_v2\(p_batch_id\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_commit_supplier_carrier_qa_v1\(jsonb\) FROM PUBLIC/);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(migration, /nexid_commit_supplier_qa_v1\(p_input\)|nexid_commit_supplier_qa_v2\(p_input\)/);
  assert.doesNotMatch(migration, /key_fingerprint[^;\n]*'(?:NONE|KEYLESS|0{16})'/i);
  assert.doesNotMatch(migration, /INSERT INTO batch_keys/i);

  assert.match(route, /carrier_observations/);
  assert.match(route, /validateSupplierCarrierQaEvidence/);
  assert.match(route, /commitSupplierCarrierQa/);
  assert.match(route, /cryptographic_authentication_verified: false/);
  assert.match(route, /qa_evidence_mode_conflict/);
  assert.match(route, /LEFT JOIN batch_keys/);
  assert.match(route, /supplier_keyless_production_qa_plan_or_physical_evidence_required/);
  assert.doesNotMatch(route, /INSERT INTO supplier_qa_carrier_evidence_receipts/);
});

test("carrier QA database errors stay bounded", () => {
  assert.deepEqual(
    supplierCarrierQaCommitError(new Error("supplier_carrier_qa_tag_binding_invalid")),
    { status: 409, reason: "supplier_carrier_qa_tag_binding_invalid" },
  );
  assert.deepEqual(
    supplierCarrierQaCommitError(Object.assign(new Error("function nexid_commit_supplier_carrier_qa_v1 does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_carrier_qa_migration_required",
      requiredMigration: SUPPLIER_CARRIER_QA_MIGRATION,
    },
  );
  assert.deepEqual(
    supplierCarrierQaCommitError(new Error("password=do-not-leak host=private")),
    { status: 503, reason: "supplier_carrier_qa_atomic_commit_unavailable" },
  );
});

test("factory templates resolve to truthful public QR, static NFC and GS1 contracts", () => {
  const orderRoute = read("apps/api/src/app/admin/supplier-orders/route.ts");
  const sunRoute = read("apps/api/src/app/sun/route.ts");
  assert.match(orderRoute, /\/sun\?qr=1&carrier=qr_basic&tenant=\$\{encodedTenant\}&bid=\$\{encodedBid\}&uid=<UID_HEX>/);
  assert.match(orderRoute, /\/sun\?channel=static_nfc&carrier=\$\{carrierProfileCode\}&tenant=\$\{encodedTenant\}&bid=\$\{encodedBid\}&uid=<UID_HEX>/);
  assert.match(orderRoute, /\/01\/<GTIN>\/10\/<LOT>\/21\/<SERIAL>`/);
  assert.doesNotMatch(orderRoute, /\/t\/\$\{encodedBid\}\/\<UID_HEX\>/);
  assert.match(sunRoute, /lowAssuranceChannel === "static_nfc"/);
  assert.match(sunRoute, /STATIC_NFC_UNVERIFIED/);
  assert.match(sunRoute, /El UID y la URL pueden copiarse/);
  assert.match(sunRoute, /tokenizationEligible: false/);
});
