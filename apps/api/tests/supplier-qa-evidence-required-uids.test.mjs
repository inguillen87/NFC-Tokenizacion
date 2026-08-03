import test from "node:test";
import assert from "node:assert/strict";

const {
  parseSupplierQaSnapshotReferences,
  supplierQaUidFingerprint,
  validateSupplierQaSunEvidence,
} = await import("../src/lib/supplier-qa-evidence.ts");
const {
  SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
  SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
} = await import("../src/lib/supplier-qa-verification-context.ts");

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "22222222-2222-4222-8222-222222222222";
const BID = "AGRO-PROD-2026-001";
const MANIFEST_HASH = `sha256:${"a".repeat(64)}`;
const CARRIER_CONFIG_DIGEST = `sha256:${"b".repeat(64)}`;
const VERIFICATION_CONTEXT_DIGEST = `sha256:${"c".repeat(64)}`;
const KEY_FINGERPRINT = "D".repeat(16);
const MANIFEST_IMPORTED_AT = "2026-08-01T12:00:00.000Z";
const EVALUATED_AT = "2026-08-01T13:00:00.000Z";

function uid(index) {
  return index.toString(16).toUpperCase().padStart(14, "0");
}

function diagnostic({ id, uidHex, counter, eventId, second, replayOriginalEventId = null }) {
  const replay = replayOriginalEventId !== null;
  const result = replay ? "REPLAY_SUSPECT" : "VALID";
  const eventCreatedAt = new Date(Date.parse(MANIFEST_IMPORTED_AT) + second * 1000).toISOString();
  const diagnosticCreatedAt = new Date(Date.parse(eventCreatedAt) + 250).toISOString();

  return {
    id,
    trace_id: `trace-${id}`,
    created_at: diagnosticCreatedAt,
    bid: BID,
    uid_hex: uidHex,
    read_counter: counter,
    auth_status: replay ? "REPLAY_SUSPECT" : "VALID",
    replay_status: replay ? "REPLAY_SUSPECT" : "NO_REPLAY",
    product_state: replay ? "REPLAY_SUSPECT" : "VALID",
    tamper_status: "CLOSED",
    tamper_opened: false,
    tagtamper_config_detected: false,
    evidence_source: "public_sun_route",
    manifest_uid_match: true,
    manifest_tag_lifecycle_state: "inactive",
    event_id: eventId,
    event_created_at: eventCreatedAt,
    event_tenant_id: TENANT_ID,
    event_batch_id: BATCH_ID,
    event_bid: BID,
    event_uid_hex: uidHex,
    event_counter: counter,
    event_cmac_ok: true,
    event_source: "real",
    event_result: result,
    replay_original_event_id: replayOriginalEventId === null ? null : String(replayOriginalEventId),
    result_json: {
      raw_result: {
        ok: !replay,
        tenant_id: TENANT_ID,
        bid: BID,
        uid: uidHex,
        ctr: counter,
        result,
        auth_status: replay ? "REPLAY_SUSPECT" : "VALID",
        tag_status: "inactive",
        product_state: replay ? "REPLAY_SUSPECT" : "VALID",
        tamper_status: "CLOSED",
        tamper_opened: false,
        tag_tamper_config_detected: false,
        event_id: eventId,
        side_effect_mode: "persist",
        cryptographic_verification: true,
        tag_tamper: {
          verified: false,
          source: "not_applicable",
          raw: "",
        },
        sun_diagnostics: {
          side_effect_mode: "persist",
          verification_method: "sun_crypto",
          cmac_valid: true,
          sdm_decryption_ok: true,
          uid_decoded: true,
          uid_hex: uidHex,
          read_counter: counter,
          verification_context_domain: SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
          verification_context_version: SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
          verification_context_digest: VERIFICATION_CONTEXT_DIGEST,
        },
      },
    },
  };
}

function fixture(count = 3) {
  const diagnostics = [];
  const urls = [];
  for (let index = 1; index <= count; index += 1) {
    const uidHex = uid(index);
    const acceptedEventId = 1_000 + index;
    const acceptedId = 100 + index;
    const replayId = 200 + index;
    diagnostics.push(diagnostic({
      id: acceptedId,
      uidHex,
      counter: index,
      eventId: acceptedEventId,
      second: index * 3,
    }));
    diagnostics.push(diagnostic({
      id: replayId,
      uidHex,
      counter: index,
      eventId: 2_000 + index,
      second: index * 3 + 1,
      replayOriginalEventId: acceptedEventId,
    }));
    urls.push(`https://nexid.lat/sun?snapshot=${acceptedId}&trace=trace-${acceptedId}`);
    urls.push(`https://nexid.lat/sun?snapshot=${replayId}&trace=trace-${replayId}`);
  }
  const parsed = parseSupplierQaSnapshotReferences(urls);
  assert.equal(parsed.ok, true);
  return { diagnostics, references: parsed.references };
}

function validate(currentFixture, requiredUidFingerprints) {
  return validateSupplierQaSunEvidence({
    references: currentFixture.references,
    diagnostics: currentFixture.diagnostics,
    expectedBid: BID,
    expectedTenantId: TENANT_ID,
    expectedBatchId: BATCH_ID,
    expectedQuantity: 10_000,
    manifestHash: MANIFEST_HASH,
    carrierProfileCode: "ntag424_dna",
    keyFingerprint: KEY_FINGERPRINT,
    carrierConfigDigest: CARRIER_CONFIG_DIGEST,
    verificationContextDigest: VERIFICATION_CONTEXT_DIGEST,
    manifestImportedAt: MANIFEST_IMPORTED_AT,
    evaluatedAt: EVALUATED_AT,
    requiresTtstatus: false,
    requiresSecureSun: true,
    requiredUidFingerprints,
  });
}

test("requiredUidFingerprints accepts only the exact server-selected SUN sample", () => {
  const selected = [1, 2, 3].map((index) => supplierQaUidFingerprint(BID, uid(index)));
  const result = validate(fixture(3), [...selected].reverse());

  assert.equal(result.ok, true);
  assert.equal(result.sampleCount, selected.length);
  assert.deepEqual(result.evidence.batch_scoped_uid_fingerprints, [...selected].sort());
  for (let index = 1; index <= 3; index += 1) {
    assert.doesNotMatch(JSON.stringify(result.evidence), new RegExp(uid(index)));
  }
});

test("requiredUidFingerprints rejects an unselected UID and a missing selected UID", () => {
  const selected = [1, 2, 99].map((index) => supplierQaUidFingerprint(BID, uid(index)));
  const wrongSet = validate(fixture(3), selected);
  assert.equal(wrongSet.ok, false);
  assert.equal(wrongSet.reason, "qa_unselected_manifest_uid_supplied");

  const exactSelection = [1, 2, 3].map((index) => supplierQaUidFingerprint(BID, uid(index)));
  const missingSelected = validate(fixture(2), exactSelection);
  assert.equal(missingSelected.ok, false);
  assert.equal(missingSelected.reason, "qa_unique_manifest_uids_required");
  assert.equal(missingSelected.requiredTags, 3);
  assert.equal(missingSelected.receivedTags, 2);
});
