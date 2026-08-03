import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPLIER_CARRIER_QA_EVIDENCE_VERSION,
  isSupplierCarrierQaSupported,
  supplierCarrierQaObservationUids,
  validateSupplierCarrierQaEvidence,
} from "../src/lib/supplier-carrier-qa-evidence.ts";

const ids = {
  tenant: "11111111-1111-4111-8111-111111111111",
  batch: "22222222-2222-4222-8222-222222222222",
  tag1: "33333333-3333-4333-8333-333333333331",
  tag2: "33333333-3333-4333-8333-333333333332",
  gs1: "44444444-4444-4444-8444-444444444444",
};
const now = new Date("2026-08-02T18:00:00.000Z");

function base(overrides = {}) {
  return {
    carrierProfileCode: "ntag213",
    expectedTenantId: ids.tenant,
    expectedTenantSlug: "syngenta",
    expectedBatchId: ids.batch,
    expectedBid: "SYN-2026-001",
    expectedQuantity: 2,
    manifestHash: `sha256:${"a".repeat(64)}`,
    manifestImportedAt: "2026-08-02T16:00:00.000Z",
    carrierConfigDigest: `sha256:${"b".repeat(64)}`,
    verificationContextDigest: `sha256:${"c".repeat(64)}`,
    publicOrigin: "https://nexid.lat",
    manifestTags: [
      { id: ids.tag1, uidHex: "04AABBCCDD1122" },
      { id: ids.tag2, uidHex: "04AABBCCDD1133" },
    ],
    operationKey: "qa-carrier-syngenta-001",
    checkedBy: "qa@nexid.lat",
    notes: "Factory sample captured from the encoded carrier.",
    notesDigest: `sha256:${"d".repeat(64)}`,
    now,
    observations: [
      {
        uid_hex: "04AABBCCDD1122",
        encoded_url: "https://nexid.lat/sun?channel=static_nfc&carrier=ntag213&tenant=syngenta&bid=SYN-2026-001&uid=04AABBCCDD1122",
        captured_at: "2026-08-02T17:00:00.000Z",
        capture_method: "nfc_ndef",
      },
      {
        uid_hex: "04AABBCCDD1133",
        encoded_url: "https://nexid.lat/sun?channel=static_nfc&carrier=ntag213&tenant=syngenta&bid=SYN-2026-001&uid=04AABBCCDD1133",
        captured_at: "2026-08-02T17:05:00.000Z",
        capture_method: "nfc_ndef",
      },
    ],
    ...overrides,
  };
}

test("non-SUN carrier support is explicit and excludes cryptographic profiles", () => {
  for (const code of [
    "qr_basic",
    "gs1_digital_link",
    "ntag213",
    "ntag215",
    "ntag216",
    "uhf_rfid",
    "event_wristband",
    "hotel_keycard",
    "iot_tracker_placeholder",
  ]) {
    assert.equal(isSupplierCarrierQaSupported(code), true);
  }
  for (const code of ["ntag424_dna", "ntag424_dna_tt", "unknown"]) {
    assert.equal(isSupplierCarrierQaSupported(code), false);
  }
});

test("NTAG213 QA binds ten-or-fewer manifest UIDs to exact static NDEF targets without claiming SUN", () => {
  const result = validateSupplierCarrierQaEvidence(base());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sampleCount, 2);
  assert.equal(result.evidence.schema_version, SUPPLIER_CARRIER_QA_EVIDENCE_VERSION);
  assert.equal(result.evidence.server_verified_sun_evidence, false);
  assert.equal(result.evidence.cryptographic_authentication_verified, false);
  assert.equal(result.evidence.anti_replay_verified, false);
  assert.equal(result.evidence.ttstatus_verified, false);
  assert.equal(result.evidence.physical_ceremony_verified, false);
  assert.equal(result.evidence.carrier_encoding_binding_verified, true);
  assert.match(result.evidenceDigest, /^sha256:[0-9a-f]{64}$/);
  const persisted = JSON.stringify({ evidence: result.evidence, rows: result.receiptRows });
  assert.doesNotMatch(persisted, /04AABBCCDD1122|04AABBCCDD1133/);
  assert.doesNotMatch(persisted, /https:\/\/nexid\.lat\/sun/);
  assert.equal(result.receiptRows.every((row) => row.capture_method === "nfc_ndef"), true);
});

test("QR QA uses the real low-assurance /sun contract and remains copyable", () => {
  const input = base({
    carrierProfileCode: "qr_basic",
    expectedQuantity: 1,
    manifestTags: [{ id: ids.tag1, uidHex: "04AABBCCDD1122" }],
    observations: [{
      uid_hex: "04AABBCCDD1122",
      encoded_url: "https://nexid.lat/sun?qr=1&carrier=qr_basic&tenant=syngenta&bid=SYN-2026-001&uid=04AABBCCDD1122",
      captured_at: "2026-08-02T17:00:00.000Z",
      capture_method: "qr_camera",
    }],
  });
  const result = validateSupplierCarrierQaEvidence(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.evidence.claim_limitations, [
    "static_identifiers_can_be_copied",
    "no_cryptographic_tag_authentication",
    "no_anti_replay_guarantee",
    "no_tamper_state_attestation",
    "operator_capture_is_not_physical_presence_attestation",
  ]);
});

test("production keyless QA binds the approved sampling plan and Packaging Lab receipt without inventing KMS or HSM custody", () => {
  const productionAcceptance = {
    sampleSize: 2,
    qaPlanId: "77777777-7777-4777-8777-777777777777",
    qaPlanDigest: `sha256:${"7".repeat(64)}`,
    qaPlanDecisionId: "88888888-8888-4888-8888-888888888888",
    packagingLabApprovalId: "99999999-9999-4999-8999-999999999999",
    packagingLabReceiptDigest: `sha256:${"9".repeat(64)}`,
  };
  const result = validateSupplierCarrierQaEvidence(base({
    packPurpose: "production",
    productionAcceptance,
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.evidence.acceptance_scope, "production_lot");
  assert.equal(result.evidence.commercial_disposition, "BLOCKED_PENDING_ACTIVATION");
  assert.equal(result.evidence.packaging_lab_approval_verified, true);
  assert.equal(result.evidence.production_qa_plan_id, productionAcceptance.qaPlanId);
  assert.equal(result.evidence.production_qa_plan_digest, productionAcceptance.qaPlanDigest);
  assert.equal(result.evidence.production_qa_plan_decision_id, productionAcceptance.qaPlanDecisionId);
  assert.equal(result.evidence.packaging_lab_approval_id, productionAcceptance.packagingLabApprovalId);
  assert.equal(result.evidence.packaging_lab_receipt_digest, productionAcceptance.packagingLabReceiptDigest);
  assert.equal(result.evidence.key_material_mode, "none");
  assert.equal(result.evidence.software_envelope, false);
  assert.equal(result.evidence.managed_kms, false);
  assert.equal(result.evidence.hsm_backed, false);
  assert.equal(result.evidence.activation_allowed, false);

  const missingPhysicalEvidence = validateSupplierCarrierQaEvidence(base({
    packPurpose: "production",
    productionAcceptance: null,
  }));
  assert.equal(missingPhysicalEvidence.ok, false);
  if (!missingPhysicalEvidence.ok) {
    assert.equal(missingPhysicalEvidence.reason, "qa_carrier_production_context_invalid");
  }
});

test("UHF QA requires the carrier-specific reader method and exact EPC target", () => {
  const result = validateSupplierCarrierQaEvidence(base({
    carrierProfileCode: "uhf_rfid",
    expectedQuantity: 1,
    manifestTags: [{ id: ids.tag1, uidHex: "04AABBCCDD1122" }],
    observations: [{
      uid_hex: "04AABBCCDD1122",
      encoded_url: "https://nexid.lat/ops/rfid/SYN-2026-001/04AABBCCDD1122",
      captured_at: "2026-08-02T17:00:00.000Z",
      capture_method: "uhf_reader",
    }],
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.receiptRows[0].capture_method, "uhf_reader");
  assert.equal(result.receiptRows[0].target_binding.kind, "nexid_uhf_epc");
});

test("GS1 QA requires an active registry identity bound to the sampled manifest tag", () => {
  const input = base({
    carrierProfileCode: "gs1_digital_link",
    expectedQuantity: 1,
    manifestTags: [{ id: ids.tag1, uidHex: "04AABBCCDD1122" }],
    gs1Identities: [{
      id: ids.gs1,
      tagId: ids.tag1,
      gtin: "09506000134352",
      lot: "LOT-26",
      serial: "SER-001",
      status: "active",
    }],
    observations: [{
      uid_hex: "04AABBCCDD1122",
      encoded_url: "https://nexid.lat/01/09506000134352/10/LOT-26/21/SER-001",
      captured_at: "2026-08-02T17:00:00.000Z",
      capture_method: "qr_camera",
    }],
  });
  const result = validateSupplierCarrierQaEvidence(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.evidence.gs1_registry_binding_verified, true);
  assert.equal(result.receiptRows[0].gs1_identity_id, ids.gs1);

  const missingRegistry = validateSupplierCarrierQaEvidence({ ...input, gs1Identities: [] });
  assert.deepEqual(missingRegistry, {
    ok: false,
    reason: "qa_carrier_gs1_registry_binding_required",
    requiredTags: 1,
    receivedTags: 1,
  });
});

test("carrier QA rejects copied/wrong, stale, insecure, dynamic-SUN and duplicate evidence fail-closed", () => {
  const cases = [
    {
      expected: "qa_carrier_manifest_uid_mismatch",
      observations: [{ ...base().observations[0], uid_hex: "04DEADBEEF0001", encoded_url: "https://nexid.lat/sun?channel=static_nfc&carrier=ntag213&tenant=syngenta&bid=SYN-2026-001&uid=04DEADBEEF0001" }, base().observations[1]],
    },
    {
      expected: "qa_carrier_observation_stale",
      observations: [{ ...base().observations[0], captured_at: "2026-07-20T17:00:00.000Z" }, base().observations[1]],
    },
    {
      expected: "qa_carrier_target_url_invalid",
      observations: [{ ...base().observations[0], encoded_url: base().observations[0].encoded_url.replace("https://", "http://") }, base().observations[1]],
    },
    {
      expected: "qa_carrier_target_url_mismatch",
      observations: [{ ...base().observations[0], encoded_url: "https://nexid.lat/sun?v=1&bid=SYN-2026-001&picc_data=AA&enc=BB&cmac=CC" }, base().observations[1]],
    },
    {
      expected: "qa_carrier_observation_duplicate",
      observations: [base().observations[0], base().observations[0]],
    },
  ];
  for (const entry of cases) {
    const result = validateSupplierCarrierQaEvidence(base({ observations: entry.observations }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, entry.expected);
  }
});

test("observation UID extraction is bounded and rejects malformed arrays before SQL lookup", () => {
  assert.deepEqual(supplierCarrierQaObservationUids(base().observations), ["04AABBCCDD1122", "04AABBCCDD1133"]);
  assert.deepEqual(supplierCarrierQaObservationUids([{ uid_hex: "not-hex" }]), []);
  assert.deepEqual(supplierCarrierQaObservationUids(Array.from({ length: 5_001 }, () => ({ uid_hex: "04AABBCC" }))), []);
});
