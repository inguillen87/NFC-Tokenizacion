import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  commitSupplierQa,
  hasSupplierQaVerificationContextV2,
  SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION,
  supplierQaCommitError,
  validSupplierQaIdempotencyKey,
} from "../src/lib/supplier-qa-commit.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function readWorkspaceFile(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

function input(overrides = {}) {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    supplierSubBatchId: "33333333-3333-4333-8333-333333333333",
    batchId: "44444444-4444-4444-8444-444444444444",
    bid: "SYN-2026-001",
    status: "passed",
    sampleCount: 10,
    replayChecked: true,
    ttstatusChecked: false,
    notes: "Server-derived SUN QA.",
    evidence: {
      schema_version: "supplier-qa-sun/v1",
      evidence_digest: `sha256:${"a".repeat(64)}`,
      physical_ceremony_verified: false,
      operation_key: "qa-operation-2026-001",
    },
    evidenceDigest: `sha256:${"a".repeat(64)}`,
    diagnosticRefs: [{
      diagnostic_id: 91,
      trace_id: "trace-91",
      reference_hash: `sha256:${"c".repeat(64)}`,
    }],
    operationKey: "qa-operation-2026-001",
    actorId: "55555555-5555-4555-8555-555555555555",
    actorEmail: "qa@nexid.lat",
    expectedManifestHash: `sha256:${"d".repeat(64)}`,
    expectedCarrierProfileCode: "ntag424_dna",
    expectedKeyFingerprint: "PAIR-FINGERPRINT",
    expectedSdmConfig: { key_version: 1 },
    expectedVerificationContextDigest: `sha256:${"e".repeat(64)}`,
    expectedVerificationContextBinding: {
      domain: "nexid:supplier-qa:verification-context",
      schema_version: "v2",
    },
    expectedVerificationContextCanonical:
      '{"domain":"nexid:supplier-qa:verification-context","schema_version":"v2"}',
    userAgent: "test",
    requestId: "request-1",
    ...overrides,
  };
}

test("supplier QA idempotency keys are explicit, bounded header-safe values", () => {
  assert.equal(validSupplierQaIdempotencyKey("qa-operation-2026-001"), true);
  assert.equal(validSupplierQaIdempotencyKey("short"), false);
  assert.equal(validSupplierQaIdempotencyKey("qa operation with spaces"), false);
  assert.equal(validSupplierQaIdempotencyKey(`q${"a".repeat(128)}`), false);
});

test("supplier QA helper performs exactly one SQL function call", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      qa_check_id: "66666666-6666-4666-8666-666666666666",
      qa_status: "passed",
      evidence_digest: `sha256:${"a".repeat(64)}`,
      evidence_event_hash: `sha256:${"b".repeat(64)}`,
      idempotent_replay: false,
    }];
  };

  const receipt = await commitSupplierQa(input(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /FROM public\.nexid_commit_supplier_qa_v2\(\?::jsonb\)/);
  assert.equal(calls[0].values.length, 1);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.operation_key, "qa-operation-2026-001");
  assert.deepEqual(payload.diagnostic_refs, input().diagnosticRefs);
  assert.deepEqual(payload.expected_verification_context_binding, input().expectedVerificationContextBinding);
  assert.equal(payload.expected_verification_context_canonical, input().expectedVerificationContextCanonical);
  assert.equal("event_hash" in payload, false);
  assert.equal("event_payload" in payload, false);
  assert.equal(receipt.qaCheckId, "66666666-6666-4666-8666-666666666666");
  assert.equal(receipt.idempotentReplay, false);
});

test("supplier QA v2 capability probe is safe against pre-0071 schemas", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ available: true }];
  };

  assert.equal(await hasSupplierQaVerificationContextV2(query), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_commit_supplier_qa_v2\(jsonb\)'\)/);
  assert.match(calls[0].statement, /to_regclass\('public\.supplier_pack_purpose_decisions'\)/);
  assert.match(calls[0].statement, /has_function_privilege\([\s\S]*nexid_commit_supplier_qa_v2/);
  assert.match(calls[0].statement, /has_table_privilege\([\s\S]*supplier_qa_verification_context_receipts/);
  assert.match(calls[0].statement, /information_schema\.columns/);
  assert.doesNotMatch(calls[0].statement, /FROM\s+supplier_pack_purpose_decisions/i);
});

test("supplier QA atomic migration owns locking, consumption and append-only projections", () => {
  const migration = readWorkspaceFile("apps/api/db/migrations/20260729130000_0070_supplier_qa_atomic_receipts.sql");
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts");
  const helper = readWorkspaceFile("apps/api/src/lib/supplier-qa-commit.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sun_diagnostics/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_qa_diagnostic_consumptions/);
  assert.match(migration, /ALTER TABLE audit_logs[\s\S]*ADD COLUMN IF NOT EXISTS resource_type/);
  assert.match(migration, /ALTER TABLE public\.audit_logs ALTER COLUMN entity_type DROP NOT NULL/);
  assert.match(migration, /diagnostic_id bigint PRIMARY KEY REFERENCES sun_diagnostics\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /canonical_event_id bigint NOT NULL/);
  assert.match(migration, /canonical_binding_digest text NOT NULL/);
  assert.match(migration, /database_binding_digest text/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_operation_key/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_qa_passed_sub_batch/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_commit_supplier_qa_v1\(p_input jsonb\)/);
  assert.match(migration, /SET search_path = public, pg_temp/);
  assert.match(migration, /FOR UPDATE OF ssb, so, b, bk/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /JOIN events e[\s\S]*FOR UPDATE OF d, e/);
  assert.match(
    migration,
    /convert_to\('supplier-qa-sun\/v1', 'UTF8'\)[\s\S]*decode\('00', 'hex'\)[\s\S]*convert_to\(d\.id::text, 'UTF8'\)[\s\S]*decode\('00', 'hex'\)[\s\S]*convert_to\(d\.trace_id, 'UTF8'\)/,
  );
  assert.doesNotMatch(migration, /chr\(0\)/);
  assert.match(migration, /consumed_sun_diagnostic_is_immutable/);
  assert.match(migration, /consumed_sun_event_is_immutable/);
  assert.match(migration, /supplier-qa-db-receipt\/v1/);
  assert.match(migration, /supplier-qa-evidence-event\/v1/);
  assert.match(migration, /supplier_qa_idempotency_key_conflict/);
  assert.match(migration, /supplier_qa_snapshot_already_consumed/);
  assert.match(migration, /supplier_qa_history_is_append_only/);
  assert.match(migration, /INSERT INTO supplier_qa_checks[\s\S]*INSERT INTO supplier_qa_diagnostic_consumptions[\s\S]*INSERT INTO vault_artifacts[\s\S]*UPDATE supplier_sub_batches[\s\S]*UPDATE batches[\s\S]*INSERT INTO evidence_events[\s\S]*INSERT INTO audit_logs/);
  assert.match(migration, /physical_ceremony_verified', false/);
  assert.match(migration, /\{raw_result,sun_diagnostics,verification_context_digest\}/);
  assert.match(migration, /UPDATE supplier_sub_batches AS target_sub_batch/);
  assert.match(migration, /target_sub_batch\.qa_status <> 'passed'/);
  assert.doesNotMatch(migration, /AND qa_status <> 'passed'/);
  assert.ok(
    migration.indexOf("FROM supplier_qa_checks q") < migration.indexOf("JOIN batch_keys bk"),
    "idempotent receipt lookup must precede mutable active-key prerequisites",
  );
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(migration, /nexid_persist_sun_scan_v1/);

  assert.match(route, /req\.headers\.get\("idempotency-key"\)/);
  assert.match(route, /operation_key: operationKey/);
  assert.match(route, /notes_digest: notesDigest/);
  assert.doesNotMatch(route, /const eventHash =/);
  assert.doesNotMatch(route, /body\.idempotency|randomUUID/);
  assert.doesNotMatch(route, /ensureSupplierOpsSchema|logAuditEvent/);
  assert.doesNotMatch(route, /INSERT INTO supplier_qa_checks|INSERT INTO vault_artifacts|UPDATE supplier_sub_batches|UPDATE batches|INSERT INTO evidence_events/);
  assert.equal((helper.match(/await query\/\*sql\*\//g) || []).length, 2);
  assert.match(helper, /FROM public\.nexid_commit_supplier_qa_v2/);
  assert.doesNotMatch(helper, /event_hash: input\.eventHash|event_payload: input\.eventPayload/);
});

test("supplier QA verification context v2 is locked, canonical and append-only", () => {
  const migration = readWorkspaceFile(SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION.replace(/\\/g, "/").startsWith("apps/")
    ? SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION
    : `apps/api/db/migrations/${SUPPLIER_QA_VERIFICATION_CONTEXT_V2_MIGRATION}`);
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts");

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_supplier_qa_canonical_json_v2\(p_value jsonb\)/);
  assert.match(migration, /ORDER BY entry\.key COLLATE "C"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS supplier_qa_verification_context_receipts/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_qa_verification_context_receipts/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_supplier_qa_verification_context_v2_capability\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_commit_supplier_qa_v2\(p_input jsonb\)/);
  assert.match(migration, /supplier-pack-purpose[\s\S]*FOR UPDATE OF ssb, so, b, bk/);
  assert.match(migration, /supplier_sub_batch_status[\s\S]*batch_status[\s\S]*key_export_count[\s\S]*batch_key_export_count/);
  assert.match(migration, /packaging_governance_status[\s\S]*packaging_spec_revision[\s\S]*packaging_spec_hash/);
  assert.match(migration, /effective_pack_purpose[\s\S]*acceptance_scope/);
  assert.match(migration, /v_expected_binding IS DISTINCT FROM v_locked_binding/);
  assert.match(migration, /v_expected_canonical IS DISTINCT FROM v_locked_canonical/);
  assert.match(migration, /v_expected_digest IS DISTINCT FROM v_locked_digest/);
  assert.ok(
    migration.indexOf("supplier_qa_verification_context_changed")
      < migration.lastIndexOf("nexid_commit_supplier_qa_v1(p_input)"),
    "the exact v2 binding must be validated before delegating the locked commit",
  );
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.match(migration, /not a signature, KMS operation, HSM attestation/);
  assert.doesNotMatch(migration, /K_META\s*=|K_FILE\s*=/);
  assert.match(migration, /q\.evidence_json->>'verification_context_digest'.*AS legacy_context_digest/);
  assert.match(migration, /supplier_qa_legacy_context_receipt_unbound/);
  assert.ok(
    migration.indexOf("supplier_qa_legacy_context_receipt_unbound")
      < migration.indexOf("RETURN QUERY SELECT * FROM public.nexid_commit_supplier_qa_v1(p_input)",
        migration.indexOf("supplier_qa_legacy_context_receipt_unbound")),
    "legacy receipts without an original bound digest must fail before v1 replay",
  );

  assert.ok(
    route.indexOf("hasSupplierQaVerificationContextV2()") < route.indexOf("so.pack_purpose AS declared_pack_purpose"),
    "the rolling capability gate must run before any 0071 schema reference",
  );
  assert.match(route, /expectedVerificationContextBinding: verificationContext\.binding/);
  assert.match(route, /expectedVerificationContextCanonical: verificationContext\.canonicalPayload/);
});

test("supplier QA database failures are normalized without leaking SQL", () => {
  assert.deepEqual(
    supplierQaCommitError(Object.assign(new Error("supplier_qa_idempotency_key_conflict"), { code: "23505" })),
    { status: 409, reason: "supplier_qa_idempotency_key_conflict" },
  );
  assert.deepEqual(
    supplierQaCommitError(Object.assign(new Error("function public.nexid_commit_supplier_qa_v1(jsonb) does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_qa_atomic_migration_required",
      requiredMigration: "20260729130000_0070_supplier_qa_atomic_receipts.sql",
    },
  );
  assert.deepEqual(
    supplierQaCommitError(Object.assign(new Error("function public.nexid_commit_supplier_qa_v2(jsonb) does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_qa_verification_context_v2_migration_required",
      requiredMigration: "20260730110000_0073_supplier_qa_verification_context_v2.sql",
    },
  );
  assert.deepEqual(
    supplierQaCommitError(Object.assign(new Error("supplier_qa_verification_context_v2_invalid"), { code: "22023" })),
    { status: 400, reason: "supplier_qa_verification_context_v2_invalid" },
  );
  assert.deepEqual(
    supplierQaCommitError(Object.assign(new Error("supplier_qa_legacy_context_receipt_unbound"), { code: "23505" })),
    { status: 409, reason: "supplier_qa_legacy_context_receipt_unbound" },
  );
  assert.deepEqual(
    supplierQaCommitError(new Error("password=must-not-leak host=internal")),
    { status: 503, reason: "supplier_qa_atomic_commit_unavailable" },
  );
});
