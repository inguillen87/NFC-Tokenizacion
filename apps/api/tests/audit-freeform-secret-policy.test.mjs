import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  auditFreeformContainsSecret,
  auditFreeformValuesAreSafe,
} from "../src/lib/audit-freeform-secret-policy.ts";
import { commitSupplierCarrierQa } from "../src/lib/supplier-carrier-qa-commit.ts";
import { transitionSupplierOrderLifecycleV1 } from "../src/lib/supplier-order-lifecycle.ts";
import { normalizeTenantVaultDownloadReason } from "../src/lib/tenant-vault.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const deterministicBase64Secret = Buffer.from(
  Array.from({ length: 48 }, (_, index) => (index * 73 + 19) % 256),
).toString("base64");

test("central audit policy rejects secret-shaped text without returning secret material", () => {
  // Build credential-shaped fixtures at runtime so the repository-wide custody
  // gate can remain literal and fail closed without treating test source as a
  // stored credential.
  const kMetaFixture = ["K_META", "_BATCH: ", "00112233445566778899AABBCCDDEEFF"].join("");
  const kFileFixture = ["K_FILE", "_BATCH=", "FFEEDDCCBBAA99887766554433221100"].join("");
  const privateKeyFixture = ["-----BEGIN ", "PRIVATE KEY", "-----"].join("");
  const rejected = [
    "PACK_PASSWORD=Factory-Only-2026!",
    kMetaFixture,
    kFileFixture,
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    deterministicBase64Secret,
    "https://factory-user:factory-password@vault.example.test/evidence",
    privateKeyFixture,
  ];
  for (const value of rejected) {
    assert.equal(auditFreeformContainsSecret(value), true);
    assert.equal(auditFreeformValuesAreSafe([value]), false);
  }

  const allowed = [
    "Factory QA desk",
    "artifact://factory-pack/receipt-1",
    "Pack entregado por el canal seguro acordado.",
    "Ticket OPS-4821 confirma la entrega operativa.",
    "Capturas estaticas revisadas; no prueban presencia fisica.",
  ];
  for (const value of allowed) assert.equal(auditFreeformContainsSecret(value), false);
});

test("Vault reason normalization fails closed before persistence", () => {
  assert.equal(normalizeTenantVaultDownloadReason("Recuperacion aprobada por Operations"), "Recuperacion aprobada por Operations");
  assert.equal(normalizeTenantVaultDownloadReason("PACK_PASSWORD=Factory-Only-2026!"), "");
  assert.equal(normalizeTenantVaultDownloadReason(deterministicBase64Secret), "");
});

test("supplier helpers reject sensitive audit inputs before issuing SQL", async () => {
  let queryCalls = 0;
  const query = async () => {
    queryCalls += 1;
    return [];
  };

  await assert.rejects(transitionSupplierOrderLifecycleV1({
    supplierOrderId: "11111111-1111-4111-8111-111111111111",
    transition: "mark_sent",
    operationKey: "supplier-lifecycle:secret-test",
    recipientRef: "Factory QA desk",
    deliveryChannel: "secure_transfer",
    evidenceRef: "https://operator:password@vault.example.test/receipt",
    reason: "Pack entregado por el canal seguro acordado.",
    actorId: "22222222-2222-4222-8222-222222222222",
    authSessionId: "33333333-3333-4333-8333-333333333333",
  }, query), /supplier_order_lifecycle_sensitive_audit_input_rejected/);

  await assert.rejects(commitSupplierCarrierQa({
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    supplierSubBatchId: "33333333-3333-4333-8333-333333333333",
    batchId: "44444444-4444-4444-8444-444444444444",
    bid: "TRIAL-1",
    sampleCount: 1,
    notes: `K_FILE_BATCH=${"AA".repeat(16)}`,
    evidence: {},
    evidenceDigest: `sha256:${"a".repeat(64)}`,
    receiptRows: [],
    operationKey: "carrier-qa:secret-test",
    actorId: "55555555-5555-4555-8555-555555555555",
    actorEmail: "qa@example.test",
    expectedManifestHash: `sha256:${"b".repeat(64)}`,
    expectedCarrierProfileCode: "ntag213",
    expectedKeyFingerprint: "0011223344556677",
    expectedSdmConfig: {},
    expectedVerificationContextDigest: `sha256:${"c".repeat(64)}`,
    expectedVerificationContextBinding: {},
    expectedVerificationContextCanonical: "{}",
    userAgent: null,
    requestId: null,
  }, query), /supplier_carrier_qa_sensitive_audit_input_rejected/);

  assert.equal(queryCalls, 0);
});

test("0084-0086 enforce the same policy inside authoritative SQL writers", () => {
  const vaultMigration = read("db/migrations/20260802190000_0084_tenant_vault_audited_download.sql");
  const carrierMigration = read("db/migrations/20260802200000_0085_supplier_non_sun_qa_evidence.sql");
  const lifecycleMigration = read("db/migrations/20260802210000_0086_supplier_order_lifecycle.sql");
  const lifecycleRoute = read("src/app/admin/supplier-orders/[orderId]/lifecycle/route.ts");
  const qaRoute = read("src/app/admin/supplier-orders/[orderId]/qa/route.ts");

  assert.match(vaultMigration, /CREATE OR REPLACE FUNCTION public\.nexid_audit_freeform_is_safe_v1\(p_value text\)/);
  assert.match(vaultMigration, /PACK\[_ -\]\?PASSWORD/);
  assert.match(vaultMigration, /PRIVATE KEY/);
  assert.match(vaultMigration, /nexid_audit_freeform_is_safe_v1\(reason\)/);
  assert.match(carrierMigration, /nexid_audit_freeform_is_safe_v1\(v_notes\)/);
  assert.match(carrierMigration, /supplier_carrier_qa_sensitive_audit_input_rejected/);
  assert.match(lifecycleMigration, /nexid_audit_freeform_is_safe_v1\(v_recipient_ref\)/);
  assert.match(lifecycleMigration, /nexid_audit_freeform_is_safe_v1\(v_evidence_ref\)/);
  assert.match(lifecycleMigration, /nexid_audit_freeform_is_safe_v1\(v_reason\)/);
  assert.match(lifecycleRoute, /auditFreeformValuesAreSafe/);
  assert.match(qaRoute, /auditFreeformValuesAreSafe/);
});
