import { createHash } from "node:crypto";

import { parseGs1DigitalLinkUri } from "./gs1-digital-link-registry";
import { supplierQaUidFingerprint } from "./supplier-qa-evidence";
import { canonicalSupplierQaJson } from "./supplier-qa-verification-context";

export const SUPPLIER_CARRIER_QA_EVIDENCE_VERSION = "supplier-qa-carrier/v1";
export const SUPPLIER_CARRIER_QA_OBSERVATION_VERSION = "supplier-qa-carrier-observation/v1";
export const SUPPLIER_CARRIER_QA_MIGRATION =
  "20260802260000_0091_supplier_keyless_qa_activation.sql";
export const SUPPLIER_CARRIER_QA_MAX_SAMPLE_SIZE = 10;
export const SUPPLIER_CARRIER_QA_MAX_PRODUCTION_SAMPLE_SIZE = 5_000;

const SUPPORTED_CARRIER_PROFILES = new Set([
  "qr_basic",
  "gs1_digital_link",
  "ntag213",
  "ntag215",
  "ntag216",
  "uhf_rfid",
  "event_wristband",
  "hotel_keycard",
  "iot_tracker_placeholder",
]);
const STATIC_NFC_PROFILES = new Set([
  "ntag213", "ntag215", "ntag216", "event_wristband", "hotel_keycard",
]);
const OBSERVATION_KEYS = new Set(["uid_hex", "encoded_url", "captured_at", "capture_method"]);
const UID_RE = /^[0-9A-F]{8,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

export type SupplierCarrierQaManifestTag = {
  id: string;
  uidHex: string;
};

export type SupplierCarrierQaGs1Identity = {
  id: string;
  tagId: string;
  gtin: string;
  lot: string;
  serial: string;
  status: string;
};

export type SupplierCarrierQaReceiptRow = {
  tag_id: string;
  carrier_profile_code: string;
  capture_method: "qr_camera" | "nfc_ndef" | "uhf_reader" | "device_telemetry";
  captured_at: string;
  uid_fingerprint: string;
  encoded_url_hash: string;
  target_binding: Record<string, unknown>;
  target_binding_digest: string;
  observation_digest: string;
  gs1_identity_id: string | null;
};

type ValidationFailure = {
  ok: false;
  reason: string;
  requiredTags: number;
  receivedTags: number;
};

type ValidationSuccess = {
  ok: true;
  sampleCount: number;
  evidence: Record<string, unknown>;
  evidenceDigest: string;
  receiptRows: SupplierCarrierQaReceiptRow[];
};

export type SupplierCarrierQaValidationResult = ValidationFailure | ValidationSuccess;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function sha256Text(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function sha256Canonical(value: unknown) {
  return sha256Text(canonicalSupplierQaJson(value));
}

function normalizedOrigin(value: unknown) {
  try {
    const parsed = new URL(text(value));
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function requiredSampleSize(expectedQuantity: unknown) {
  const parsed = Number(expectedQuantity);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(SUPPLIER_CARRIER_QA_MAX_SAMPLE_SIZE, parsed)
    : 0;
}

export function isSupplierCarrierQaSupported(carrierProfileCode: unknown) {
  return SUPPORTED_CARRIER_PROFILES.has(text(carrierProfileCode).toLowerCase());
}

export function supplierCarrierQaObservationUids(observations: unknown) {
  if (!Array.isArray(observations) || observations.length > SUPPLIER_CARRIER_QA_MAX_PRODUCTION_SAMPLE_SIZE) return [];
  const values: string[] = [];
  for (const observation of observations) {
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) return [];
    const uidHex = text((observation as Record<string, unknown>).uid_hex).toUpperCase();
    if (!UID_RE.test(uidHex)) return [];
    values.push(uidHex);
  }
  return [...new Set(values)];
}

function fail(reason: string, requiredTags: number, receivedTags: number): ValidationFailure {
  return { ok: false, reason, requiredTags, receivedTags };
}

function exactStaticTarget(input: {
  origin: string;
  tenantSlug: string;
  bid: string;
  uidHex: string;
  carrierProfileCode: string;
}) {
  const target = new URL("/sun", `${input.origin}/`);
  if (input.carrierProfileCode === "qr_basic") {
    target.searchParams.set("qr", "1");
    target.searchParams.set("carrier", input.carrierProfileCode);
    target.searchParams.set("tenant", input.tenantSlug);
    target.searchParams.set("bid", input.bid);
    target.searchParams.set("uid", input.uidHex);
    return target.href;
  }
  if (new Set(["ntag213", "ntag215", "ntag216"]).has(input.carrierProfileCode)) {
    target.searchParams.set("channel", "static_nfc");
    target.searchParams.set("carrier", input.carrierProfileCode);
    target.searchParams.set("tenant", input.tenantSlug);
    target.searchParams.set("bid", input.bid);
    target.searchParams.set("uid", input.uidHex);
    return target.href;
  }
  if (input.carrierProfileCode === "uhf_rfid") {
    return new URL(`/ops/rfid/${encodeURIComponent(input.bid)}/${encodeURIComponent(input.uidHex)}`, input.origin).href;
  }
  if (input.carrierProfileCode === "event_wristband") {
    return new URL(`/event/${encodeURIComponent(input.bid)}/${encodeURIComponent(input.uidHex)}`, input.origin).href;
  }
  if (input.carrierProfileCode === "hotel_keycard") {
    return new URL(`/credential/${encodeURIComponent(input.bid)}/${encodeURIComponent(input.uidHex)}`, input.origin).href;
  }
  return new URL(`/telemetry/${encodeURIComponent(input.bid)}/${encodeURIComponent(input.uidHex)}`, input.origin).href;
}

function exactGs1Target(origin: string, identity: SupplierCarrierQaGs1Identity) {
  const parts = ["01", identity.gtin];
  if (identity.lot) parts.push("10", identity.lot);
  if (identity.serial) parts.push("21", identity.serial);
  return `${origin}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

/**
 * Validates factory-recorded static-carrier samples against the immutable
 * manifest scope. This is encoding/binding evidence only: it is not SUN/CMAC,
 * anti-replay, tamper, physical-presence, KMS or HSM evidence.
 */
export function validateSupplierCarrierQaEvidence(input: {
  observations: unknown;
  carrierProfileCode: unknown;
  expectedTenantId: unknown;
  expectedTenantSlug: unknown;
  expectedBatchId: unknown;
  expectedBid: unknown;
  expectedQuantity: unknown;
  manifestHash: unknown;
  manifestImportedAt: unknown;
  carrierConfigDigest: unknown;
  verificationContextDigest: unknown;
  publicOrigin: unknown;
  manifestTags: SupplierCarrierQaManifestTag[];
  gs1Identities?: SupplierCarrierQaGs1Identity[];
  operationKey: unknown;
  checkedBy: unknown;
  notes: string | null;
  notesDigest: string | null;
  packPurpose?: unknown;
  productionAcceptance?: {
    sampleSize: number;
    qaPlanId: string;
    qaPlanDigest: string;
    qaPlanDecisionId: string;
    packagingLabApprovalId: string;
    packagingLabReceiptDigest: string;
  } | null;
  now?: Date;
}): SupplierCarrierQaValidationResult {
  const carrierProfileCode = text(input.carrierProfileCode).toLowerCase();
  const packPurpose = text(input.packPurpose || "trial_integration").toLowerCase();
  const productionAcceptance = input.productionAcceptance || null;
  const requiredTags = packPurpose === "production"
    ? Number(productionAcceptance?.sampleSize || 0)
    : requiredSampleSize(input.expectedQuantity);
  const receivedTags = Array.isArray(input.observations) ? input.observations.length : 0;
  if (!SUPPORTED_CARRIER_PROFILES.has(carrierProfileCode)) {
    return fail("qa_carrier_evidence_strategy_not_implemented", requiredTags, receivedTags);
  }
  if (
    !new Set(["trial_integration", "production"]).has(packPurpose)
    || (packPurpose === "production" && (
      !productionAcceptance
      || !Number.isSafeInteger(requiredTags)
      || requiredTags < 1
      || requiredTags > SUPPLIER_CARRIER_QA_MAX_PRODUCTION_SAMPLE_SIZE
      || !UUID_RE.test(text(productionAcceptance.qaPlanId))
      || !SHA256_RE.test(text(productionAcceptance.qaPlanDigest).toLowerCase())
      || !UUID_RE.test(text(productionAcceptance.qaPlanDecisionId))
      || !UUID_RE.test(text(productionAcceptance.packagingLabApprovalId))
      || !SHA256_RE.test(text(productionAcceptance.packagingLabReceiptDigest).toLowerCase())
    ))
    || (packPurpose === "trial_integration" && productionAcceptance)
  ) return fail("qa_carrier_production_context_invalid", requiredTags, receivedTags);
  if (!requiredTags) return fail("qa_carrier_expected_quantity_invalid", requiredTags, receivedTags);
  if (!Array.isArray(input.observations) || receivedTags !== requiredTags) {
    return fail("qa_carrier_sample_size_invalid", requiredTags, receivedTags);
  }

  const tenantId = text(input.expectedTenantId).toLowerCase();
  const tenantSlug = text(input.expectedTenantSlug).toLowerCase();
  const batchId = text(input.expectedBatchId).toLowerCase();
  const bid = text(input.expectedBid).toUpperCase();
  const manifestHash = text(input.manifestHash).toLowerCase();
  const carrierConfigDigest = text(input.carrierConfigDigest).toLowerCase();
  const verificationContextDigest = text(input.verificationContextDigest).toLowerCase();
  const publicOrigin = normalizedOrigin(input.publicOrigin);
  const operationKey = text(input.operationKey);
  const checkedBy = text(input.checkedBy).toLowerCase();
  if (
    !UUID_RE.test(tenantId)
    || !UUID_RE.test(batchId)
    || !TENANT_SLUG_RE.test(tenantSlug)
    || !BID_RE.test(bid)
    || !SHA256_RE.test(manifestHash)
    || !SHA256_RE.test(carrierConfigDigest)
    || !SHA256_RE.test(verificationContextDigest)
    || !publicOrigin
    || !operationKey
    || !checkedBy
  ) return fail("qa_carrier_context_invalid", requiredTags, receivedTags);

  const manifestImportedAt = new Date(text(input.manifestImportedAt));
  const now = input.now || new Date();
  if (!Number.isFinite(manifestImportedAt.getTime()) || !Number.isFinite(now.getTime())) {
    return fail("qa_carrier_context_invalid", requiredTags, receivedTags);
  }
  const freshnessFloor = Math.max(manifestImportedAt.getTime(), now.getTime() - 72 * 60 * 60 * 1000);
  const futureCeiling = now.getTime() + 60 * 1000;

  const manifestByUid = new Map<string, SupplierCarrierQaManifestTag>();
  for (const tag of input.manifestTags || []) {
    const uidHex = text(tag.uidHex).toUpperCase();
    const id = text(tag.id).toLowerCase();
    if (UID_RE.test(uidHex) && UUID_RE.test(id)) manifestByUid.set(uidHex, { id, uidHex });
  }
  const gs1ByTagId = new Map<string, SupplierCarrierQaGs1Identity>();
  for (const identity of input.gs1Identities || []) {
    const id = text(identity.id).toLowerCase();
    const tagId = text(identity.tagId).toLowerCase();
    if (UUID_RE.test(id) && UUID_RE.test(tagId) && text(identity.status).toLowerCase() === "active") {
      gs1ByTagId.set(tagId, {
        id,
        tagId,
        gtin: text(identity.gtin),
        lot: text(identity.lot),
        serial: text(identity.serial),
        status: "active",
      });
    }
  }

  const expectedCaptureMethod = STATIC_NFC_PROFILES.has(carrierProfileCode)
    ? "nfc_ndef"
    : carrierProfileCode === "uhf_rfid"
      ? "uhf_reader"
      : carrierProfileCode === "iot_tracker_placeholder"
        ? "device_telemetry"
        : "qr_camera";
  const seenUids = new Set<string>();
  const receiptRows: SupplierCarrierQaReceiptRow[] = [];
  for (const rawObservation of input.observations) {
    if (!rawObservation || typeof rawObservation !== "object" || Array.isArray(rawObservation)) {
      return fail("qa_carrier_observation_invalid", requiredTags, receivedTags);
    }
    const observation = rawObservation as Record<string, unknown>;
    if (Object.keys(observation).some((key) => !OBSERVATION_KEYS.has(key))) {
      return fail("qa_carrier_observation_fields_invalid", requiredTags, receivedTags);
    }
    const uidHex = text(observation.uid_hex).toUpperCase();
    const encodedUrl = text(observation.encoded_url);
    const captureMethod = text(observation.capture_method).toLowerCase();
    const capturedDate = new Date(text(observation.captured_at));
    if (!UID_RE.test(uidHex) || !encodedUrl || encodedUrl.length > 2048 || captureMethod !== expectedCaptureMethod) {
      return fail("qa_carrier_observation_invalid", requiredTags, receivedTags);
    }
    if (!Number.isFinite(capturedDate.getTime()) || capturedDate.getTime() < freshnessFloor || capturedDate.getTime() > futureCeiling) {
      return fail("qa_carrier_observation_stale", requiredTags, receivedTags);
    }
    if (seenUids.has(uidHex)) return fail("qa_carrier_observation_duplicate", requiredTags, receivedTags);
    seenUids.add(uidHex);
    const manifestTag = manifestByUid.get(uidHex);
    if (!manifestTag) return fail("qa_carrier_manifest_uid_mismatch", requiredTags, receivedTags);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(encodedUrl);
    } catch {
      return fail("qa_carrier_target_url_invalid", requiredTags, receivedTags);
    }
    if (
      parsedUrl.protocol !== "https:"
      || parsedUrl.origin !== publicOrigin
      || parsedUrl.username
      || parsedUrl.password
      || parsedUrl.hash
    ) return fail("qa_carrier_target_url_invalid", requiredTags, receivedTags);

    const uidFingerprint = supplierQaUidFingerprint(bid, uidHex);
    let gs1IdentityId: string | null = null;
    let targetBinding: Record<string, unknown>;
    if (carrierProfileCode === "gs1_digital_link") {
      if (parsedUrl.search) return fail("qa_carrier_target_url_invalid", requiredTags, receivedTags);
      const gs1Identity = gs1ByTagId.get(manifestTag.id);
      if (!gs1Identity) return fail("qa_carrier_gs1_registry_binding_required", requiredTags, receivedTags);
      let parsedIdentity;
      try {
        parsedIdentity = parseGs1DigitalLinkUri(encodedUrl);
      } catch {
        return fail("qa_carrier_target_url_invalid", requiredTags, receivedTags);
      }
      if (
        parsedIdentity.gtin !== gs1Identity.gtin
        || parsedIdentity.lot !== gs1Identity.lot
        || parsedIdentity.serial !== gs1Identity.serial
        || encodedUrl !== exactGs1Target(publicOrigin, gs1Identity)
      ) return fail("qa_carrier_gs1_registry_mismatch", requiredTags, receivedTags);
      gs1IdentityId = gs1Identity.id;
      targetBinding = {
        kind: "gs1_digital_link",
        public_origin: publicOrigin,
        gtin: gs1Identity.gtin,
        lot: gs1Identity.lot,
        serial: gs1Identity.serial,
        gs1_identity_id: gs1Identity.id,
      };
    } else {
      const expectedUrl = exactStaticTarget({
        origin: publicOrigin,
        tenantSlug,
        bid,
        uidHex,
        carrierProfileCode,
      });
      if (encodedUrl !== expectedUrl) return fail("qa_carrier_target_url_mismatch", requiredTags, receivedTags);
      targetBinding = {
        kind: carrierProfileCode === "qr_basic"
          ? "nexid_static_qr"
          : carrierProfileCode === "uhf_rfid"
            ? "nexid_uhf_epc"
            : carrierProfileCode === "iot_tracker_placeholder"
              ? "nexid_iot_identity"
              : "nexid_static_nfc",
        public_origin: publicOrigin,
        tenant_slug: tenantSlug,
        bid,
        carrier_profile_code: carrierProfileCode,
        uid_fingerprint: uidFingerprint,
      };
    }
    const targetBindingDigest = sha256Canonical(targetBinding);
    const capturedAt = capturedDate.toISOString();
    const encodedUrlHash = sha256Text(encodedUrl);
    const observationBinding = {
      schema_version: SUPPLIER_CARRIER_QA_OBSERVATION_VERSION,
      tenant_id: tenantId,
      batch_id: batchId,
      bid,
      tag_id: manifestTag.id,
      carrier_profile_code: carrierProfileCode,
      capture_method: captureMethod,
      captured_at: capturedAt,
      uid_fingerprint: uidFingerprint,
      encoded_url_hash: encodedUrlHash,
      target_binding_digest: targetBindingDigest,
      gs1_identity_id: gs1IdentityId,
    };
    receiptRows.push({
      tag_id: manifestTag.id,
      carrier_profile_code: carrierProfileCode,
      capture_method: captureMethod as SupplierCarrierQaReceiptRow["capture_method"],
      captured_at: capturedAt,
      uid_fingerprint: uidFingerprint,
      encoded_url_hash: encodedUrlHash,
      target_binding: targetBinding,
      target_binding_digest: targetBindingDigest,
      observation_digest: sha256Canonical(observationBinding),
      gs1_identity_id: gs1IdentityId,
    });
  }

  receiptRows.sort((left, right) => left.uid_fingerprint < right.uid_fingerprint ? -1 : left.uid_fingerprint > right.uid_fingerprint ? 1 : 0);
  const observationReceipts = receiptRows.map((row) => ({
    uid_fingerprint: row.uid_fingerprint,
    encoded_url_hash: row.encoded_url_hash,
    target_binding_digest: row.target_binding_digest,
    observation_digest: row.observation_digest,
    capture_method: row.capture_method,
    captured_at: row.captured_at,
    gs1_identity_id: row.gs1_identity_id,
  }));
  const evidenceWithoutDigest = {
    schema_version: SUPPLIER_CARRIER_QA_EVIDENCE_VERSION,
    evidence_source: "server_validated_operator_capture",
    assurance_scope: "manifest_and_carrier_encoding_binding",
    carrier_profile_code: carrierProfileCode,
    sample_count: receiptRows.length,
    manifest_hash: manifestHash,
    carrier_config_digest: carrierConfigDigest,
    verification_context_digest: verificationContextDigest,
    public_origin: publicOrigin,
    manifest_uid_binding_verified: true,
    carrier_encoding_binding_verified: true,
    gs1_registry_binding_verified: carrierProfileCode === "gs1_digital_link",
    server_verified_sun_evidence: false,
    cryptographic_authentication_verified: false,
    anti_replay_verified: false,
    ttstatus_verified: false,
    physical_ceremony_verified: false,
    requires_secure_sun: false,
    key_material_mode: "none",
    software_envelope: false,
    managed_kms: false,
    hsm_backed: false,
    packaging_lab_approval_verified: packPurpose === "production",
    pack_purpose: packPurpose,
    acceptance_scope: packPurpose === "production" ? "production_lot" : "trial_integration",
    commercial_disposition: packPurpose === "production" ? "BLOCKED_PENDING_ACTIVATION" : "NON_SELLABLE",
    activation_allowed: false,
    ...(packPurpose === "production" && productionAcceptance ? {
      production_qa_plan_id: text(productionAcceptance.qaPlanId).toLowerCase(),
      production_qa_plan_digest: text(productionAcceptance.qaPlanDigest).toLowerCase(),
      production_qa_plan_decision_id: text(productionAcceptance.qaPlanDecisionId).toLowerCase(),
      packaging_lab_approval_id: text(productionAcceptance.packagingLabApprovalId).toLowerCase(),
      packaging_lab_receipt_digest: text(productionAcceptance.packagingLabReceiptDigest).toLowerCase(),
    } : {}),
    operation_key: operationKey,
    notes_digest: input.notesDigest,
    notes: input.notes,
    checked_by: checkedBy,
    claim_limitations: [
      "static_identifiers_can_be_copied",
      "no_cryptographic_tag_authentication",
      "no_anti_replay_guarantee",
      "no_tamper_state_attestation",
      "operator_capture_is_not_physical_presence_attestation",
    ],
    batch_scoped_uid_fingerprints: receiptRows.map((row) => row.uid_fingerprint),
    observation_receipts: observationReceipts,
  };
  const evidenceDigest = sha256Canonical(evidenceWithoutDigest);
  return {
    ok: true,
    sampleCount: receiptRows.length,
    evidence: { ...evidenceWithoutDigest, evidence_digest: evidenceDigest },
    evidenceDigest,
    receiptRows,
  };
}
