import { createHash } from "node:crypto";
import { hashEvidencePayload } from "./proof-layer.ts";
import {
  SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN,
  SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION,
} from "./supplier-qa-verification-context.ts";

export const SUPPLIER_QA_SUN_EVIDENCE_VERSION = "supplier-qa-sun/v1";
export const SUPPLIER_QA_MAX_REFERENCES = 60;
export const SUPPLIER_QA_TARGET_SAMPLE_SIZE = 10;
export const SUPPLIER_QA_EVIDENCE_TTL_MS = 72 * 60 * 60 * 1000;

const LIVE_SUN_EVIDENCE_SOURCE = "public_sun_route";
const AUTHENTIC_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "VALID_CLOSED",
  "VALID_UNKNOWN_TAMPER",
  "OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "NOT_ACTIVE",
]);
const CLOSED_STATES = new Set(["VALID_CLOSED"]);
const OPENED_STATES = new Set(["VALID_OPENED"]);

export type SupplierQaSnapshotReference = {
  diagnosticId: number;
  traceId: string;
  referenceHash: string;
};

export type SupplierQaDiagnosticRow = {
  id?: unknown;
  trace_id?: unknown;
  created_at?: unknown;
  bid?: unknown;
  uid_hex?: unknown;
  read_counter?: unknown;
  auth_status?: unknown;
  replay_status?: unknown;
  product_state?: unknown;
  tamper_status?: unknown;
  tamper_opened?: unknown;
  tagtamper_config_detected?: unknown;
  evidence_source?: unknown;
  manifest_uid_match?: unknown;
  manifest_tag_lifecycle_state?: unknown;
  event_id?: unknown;
  event_created_at?: unknown;
  event_tenant_id?: unknown;
  event_batch_id?: unknown;
  event_bid?: unknown;
  event_uid_hex?: unknown;
  event_counter?: unknown;
  event_cmac_ok?: unknown;
  event_source?: unknown;
  event_result?: unknown;
  replay_original_event_id?: unknown;
  result_json?: unknown;
};

type NormalizedDiagnostic = {
  diagnosticId: number;
  traceId: string;
  referenceHash: string;
  createdAt: string;
  createdAtEpoch: number;
  eventId: number;
  eventCreatedAt: string;
  eventCreatedAtEpoch: number;
  replayOriginalEventId: number | null;
  uid: string;
  counter: number;
  authStatus: string;
  replayStatus: string;
  productState: string;
  tamperStatus: string;
  tamperOpened: boolean;
  manifestTagLifecycleState: string;
  isReplay: boolean;
  isAuthentic: boolean;
  isClosed: boolean;
  isElectronicOpened: boolean;
  isOpened: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedUpper(value: unknown) {
  return normalizedText(value).toUpperCase();
}

export function supplierQaDiagnosticReferenceHash(diagnosticId: number, traceId: string) {
  return `sha256:${createHash("sha256")
    .update(`${SUPPLIER_QA_SUN_EVIDENCE_VERSION}\u0000${diagnosticId}\u0000${traceId}`, "utf8")
    .digest("hex")}`;
}

function isLoopbackHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function parseSnapshotReference(value: string):
  | { ok: true; reference: SupplierQaSnapshotReference }
  | { ok: false; reason: string } {
  if (value.length > 4096) return { ok: false, reason: "qa_snapshot_reference_too_long" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "qa_snapshot_reference_invalid" };
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    return { ok: false, reason: "qa_snapshot_reference_scheme_invalid" };
  }
  const diagnosticId = Number(url.searchParams.get("snapshot"));
  if (!Number.isSafeInteger(diagnosticId) || diagnosticId <= 0) {
    return { ok: false, reason: "qa_snapshot_id_required" };
  }
  const traceId = normalizedText(url.searchParams.get("trace"));
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(traceId)) {
    return { ok: false, reason: "qa_snapshot_trace_required" };
  }
  return {
    ok: true,
    reference: {
      diagnosticId,
      traceId,
      referenceHash: supplierQaDiagnosticReferenceHash(diagnosticId, traceId),
    },
  };
}

export function parseSupplierQaSnapshotReferences(values?: unknown[] | null):
  | { ok: true; references: SupplierQaSnapshotReference[] }
  | { ok: false; reason: string; referenceCount: number; reference?: string } {
  const supplied = Array.isArray(values)
    ? values.map((value) => normalizedText(value)).filter(Boolean)
    : [];
  if (!supplied.length) {
    return { ok: false, reason: "qa_snapshot_evidence_required", referenceCount: 0 };
  }
  if (supplied.length > SUPPLIER_QA_MAX_REFERENCES) {
    return { ok: false, reason: "qa_snapshot_reference_limit_exceeded", referenceCount: supplied.length };
  }

  const references: SupplierQaSnapshotReference[] = [];
  const seen = new Set<string>();
  for (const value of supplied) {
    const parsed = parseSnapshotReference(value);
    if (!parsed.ok) {
      return { ok: false, reason: parsed.reason, referenceCount: supplied.length, reference: value };
    }
    const key = `${parsed.reference.diagnosticId}:${parsed.reference.traceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(parsed.reference);
  }
  return { ok: true, references };
}

function fingerprintUid(expectedBid: string, uid: string) {
  return `sha256:${createHash("sha256").update(`${expectedBid.toUpperCase()}\u0000${uid.toUpperCase()}`, "utf8").digest("hex")}`;
}

function parseTimestamp(value: unknown) {
  const text = normalizedText(value);
  const epoch = Date.parse(text);
  return Number.isFinite(epoch) ? { text, epoch } : null;
}

function parseNonNegativeInteger(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  const text = normalizedText(value);
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function sortNewestFirst(rows: NormalizedDiagnostic[]) {
  return [...rows].sort((a, b) => b.counter - a.counter || b.diagnosticId - a.diagnosticId);
}

function receipt(row: NormalizedDiagnostic, expectedBid: string) {
  return {
    diagnostic_id: row.diagnosticId,
    canonical_event_id: row.eventId,
    diagnostic_reference_hash: row.referenceHash,
    batch_scoped_uid_fingerprint: fingerprintUid(expectedBid, row.uid),
    read_counter: row.counter,
    product_state: row.productState,
    created_at: row.createdAt,
  };
}

function requiredManifestTagCount(expectedQuantity: unknown) {
  const quantity = Math.trunc(Number(expectedQuantity));
  if (!Number.isFinite(quantity) || quantity <= 0) return SUPPLIER_QA_TARGET_SAMPLE_SIZE;
  return Math.min(SUPPLIER_QA_TARGET_SAMPLE_SIZE, quantity);
}

export function validateSupplierQaSunEvidence(input: {
  references: SupplierQaSnapshotReference[];
  diagnostics: SupplierQaDiagnosticRow[];
  expectedBid: string;
  expectedTenantId: string;
  expectedBatchId: string;
  expectedQuantity: number;
  manifestHash: string;
  carrierProfileCode: string;
  keyFingerprint: string;
  carrierConfigDigest: string;
  verificationContextDigest: string;
  manifestImportedAt: string;
  evaluatedAt?: string;
  requiresTtstatus: boolean;
  requiresSecureSun: boolean;
}) {
  const expectedBid = normalizedText(input.expectedBid);
  const expectedTenantId = normalizedText(input.expectedTenantId);
  const expectedBatchId = normalizedText(input.expectedBatchId);
  const manifestHash = normalizedText(input.manifestHash);
  const carrierProfileCode = normalizedText(input.carrierProfileCode).toLowerCase();
  const keyFingerprint = normalizedText(input.keyFingerprint);
  const carrierConfigDigest = normalizedText(input.carrierConfigDigest);
  const verificationContextDigest = normalizedText(input.verificationContextDigest);
  const manifestImportedAt = parseTimestamp(input.manifestImportedAt);
  const evaluatedAt = parseTimestamp(input.evaluatedAt || new Date().toISOString());
  const requiredTags = requiredManifestTagCount(input.expectedQuantity);
  const canonicalDigestPattern = /^sha256:[0-9a-f]{64}$/;
  if (
    !expectedBid
    || !expectedTenantId
    || !expectedBatchId
    || !canonicalDigestPattern.test(manifestHash)
    || !carrierProfileCode
    || !canonicalDigestPattern.test(carrierConfigDigest)
    || !canonicalDigestPattern.test(verificationContextDigest)
    || (input.requiresSecureSun && !/^[0-9A-F]{16}$/.test(keyFingerprint.toUpperCase()))
    || !manifestImportedAt
    || !evaluatedAt
  ) {
    return { ok: false as const, reason: "qa_evidence_scope_incomplete", requiredTags };
  }

  const rowsByReference = new Map<string, SupplierQaDiagnosticRow>();
  for (const row of input.diagnostics) {
    const id = Number(row.id);
    const traceId = normalizedText(row.trace_id);
    if (Number.isSafeInteger(id) && id > 0 && traceId) rowsByReference.set(`${id}:${traceId}`, row);
  }

  const normalized: NormalizedDiagnostic[] = [];
  for (const reference of input.references) {
    const row = rowsByReference.get(`${reference.diagnosticId}:${reference.traceId}`);
    if (!row) {
      return { ok: false as const, reason: "qa_snapshot_not_found", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (normalizedText(row.evidence_source) !== LIVE_SUN_EVIDENCE_SOURCE) {
      return { ok: false as const, reason: "qa_public_sun_route_required", requiredTags, diagnosticId: reference.diagnosticId };
    }
    const createdAt = parseTimestamp(row.created_at);
    if (!createdAt || createdAt.epoch < manifestImportedAt.epoch) {
      return { ok: false as const, reason: "qa_snapshot_predates_manifest", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (createdAt.epoch > evaluatedAt.epoch + 60_000 || evaluatedAt.epoch - createdAt.epoch > SUPPLIER_QA_EVIDENCE_TTL_MS) {
      return { ok: false as const, reason: "qa_snapshot_outside_evidence_window", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (normalizedUpper(row.bid) !== expectedBid.toUpperCase()) {
      return { ok: false as const, reason: "qa_snapshot_bid_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (row.manifest_uid_match !== true) {
      return { ok: false as const, reason: "qa_snapshot_uid_not_in_manifest", requiredTags, diagnosticId: reference.diagnosticId };
    }

    const resultJson = asRecord(row.result_json);
    const rawResult = asRecord(resultJson.raw_result);
    const sunDiagnostics = asRecord(rawResult.sun_diagnostics);
    const tagTamper = asRecord(rawResult.tag_tamper);
    if (normalizedText(rawResult.tenant_id) !== expectedTenantId) {
      return { ok: false as const, reason: "qa_snapshot_tenant_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (normalizedUpper(rawResult.bid) !== expectedBid.toUpperCase()) {
      return { ok: false as const, reason: "qa_snapshot_result_bid_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    const cryptographicallyVerified = rawResult.cryptographic_verification === true
      && sunDiagnostics.cmac_valid === true
      && sunDiagnostics.sdm_decryption_ok === true
      && sunDiagnostics.uid_decoded === true
      && normalizedText(rawResult.side_effect_mode) === "persist"
      && normalizedText(sunDiagnostics.side_effect_mode) === "persist"
      && normalizedText(sunDiagnostics.verification_method) === "sun_crypto";
    if (input.requiresSecureSun && !cryptographicallyVerified) {
      return { ok: false as const, reason: "qa_cryptographic_sun_verification_required", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (
      normalizedText(sunDiagnostics.verification_context_domain) !== SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN
      || normalizedText(sunDiagnostics.verification_context_version) !== SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION
      || normalizedText(sunDiagnostics.verification_context_digest) !== verificationContextDigest
    ) {
      return { ok: false as const, reason: "qa_verification_context_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }

    const uid = normalizedUpper(row.uid_hex);
    const counter = parseNonNegativeInteger(row.read_counter);
    if (!(input.requiresSecureSun ? /^[0-9A-F]{14}$/.test(uid) : /^[0-9A-F]{8,32}$/.test(uid))) {
      return { ok: false as const, reason: "qa_snapshot_uid_required", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (counter == null || counter > 0xFFFFFF) {
      return { ok: false as const, reason: "qa_snapshot_counter_required", requiredTags, diagnosticId: reference.diagnosticId };
    }
    const rawUid = normalizedUpper(rawResult.uid);
    const rawCounter = parseNonNegativeInteger(rawResult.ctr);
    if (rawUid !== uid || rawCounter !== counter) {
      return { ok: false as const, reason: "qa_snapshot_result_identity_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    const diagnosticUid = normalizedUpper(sunDiagnostics.uid_hex);
    const diagnosticCounter = parseNonNegativeInteger(sunDiagnostics.read_counter);
    if (diagnosticUid !== uid || diagnosticCounter !== counter) {
      return { ok: false as const, reason: "qa_snapshot_result_identity_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }

    const rawEventId = Number(rawResult.event_id);
    const eventId = Number(row.event_id);
    const eventCreatedAt = parseTimestamp(row.event_created_at);
    const eventCounter = parseNonNegativeInteger(row.event_counter);
    if (!Number.isSafeInteger(rawEventId) || rawEventId <= 0 || eventId !== rawEventId || !eventCreatedAt) {
      return { ok: false as const, reason: "qa_canonical_event_required", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (eventCreatedAt.epoch > createdAt.epoch || createdAt.epoch - eventCreatedAt.epoch > 5 * 60 * 1000) {
      return { ok: false as const, reason: "qa_diagnostic_event_time_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (
      normalizedText(row.event_tenant_id) !== expectedTenantId
      || normalizedText(row.event_batch_id) !== expectedBatchId
      || normalizedUpper(row.event_bid) !== expectedBid.toUpperCase()
      || normalizedUpper(row.event_uid_hex) !== uid
      || eventCounter == null
      || eventCounter !== counter
      || row.event_cmac_ok !== true
      || normalizedText(row.event_source).toLowerCase() !== "real"
    ) {
      return { ok: false as const, reason: "qa_canonical_event_scope_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }

    const authStatus = normalizedUpper(row.auth_status);
    const replayStatus = normalizedUpper(row.replay_status);
    const productState = normalizedUpper(row.product_state);
    const tamperStatus = normalizedUpper(row.tamper_status);
    const rawResultCode = normalizedUpper(rawResult.result);
    if (normalizedUpper(row.event_result) !== rawResultCode) {
      return { ok: false as const, reason: "qa_canonical_event_result_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    if (
      normalizedUpper(rawResult.product_state) !== productState
      || normalizedUpper(rawResult.tamper_status) !== tamperStatus
      || typeof rawResult.tamper_opened !== "boolean"
      || rawResult.tamper_opened !== (row.tamper_opened === true)
      || typeof rawResult.tag_tamper_config_detected !== "boolean"
      || rawResult.tag_tamper_config_detected !== (row.tagtamper_config_detected === true)
    ) {
      return { ok: false as const, reason: "qa_snapshot_result_state_mismatch", requiredTags, diagnosticId: reference.diagnosticId };
    }
    const replayOriginalEventId = Number(row.replay_original_event_id);
    const normalizedReplayOriginalEventId = Number.isSafeInteger(replayOriginalEventId) && replayOriginalEventId > 0
      ? replayOriginalEventId
      : null;
    const isReplay = rawResultCode === "REPLAY_SUSPECT"
      && (replayStatus === "REPLAY_SUSPECT"
        || authStatus === "REPLAY_SUSPECT"
        || productState === "REPLAY_SUSPECT");
    const authStatusConsistent = normalizedUpper(rawResult.auth_status) === authStatus;
    const inactiveQaSample = rawResultCode === "NOT_ACTIVE" && normalizedText(rawResult.tag_status).toLowerCase() === "inactive";
    const isAuthentic = !isReplay
      && cryptographicallyVerified
      && authStatusConsistent
      && replayStatus === "NO_REPLAY"
      && AUTHENTIC_RESULTS.has(rawResultCode)
      && (rawResultCode !== "NOT_ACTIVE" || inactiveQaSample);
    const hasElectronicTagTamperEvidence = row.tagtamper_config_detected === true
      && tagTamper.verified === true
      && ["enc_decrypted", "picc_data_decrypted"].includes(normalizedText(tagTamper.source));
    const isClosed = isAuthentic
      && CLOSED_STATES.has(productState)
      && tamperStatus === "CLOSED"
      && hasElectronicTagTamperEvidence
      && Boolean(normalizedText(tagTamper.raw));
    const isElectronicOpened = isAuthentic
      && OPENED_STATES.has(productState)
      && tamperStatus === "OPENED"
      && row.tamper_opened === true
      && hasElectronicTagTamperEvidence
      && Boolean(normalizedText(tagTamper.raw));
    const isOpened = isElectronicOpened
      && normalizedText(row.manifest_tag_lifecycle_state).toLowerCase() === "revoked";

    normalized.push({
      diagnosticId: reference.diagnosticId,
      traceId: reference.traceId,
      referenceHash: reference.referenceHash,
      createdAt: createdAt.text,
      createdAtEpoch: createdAt.epoch,
      eventId,
      eventCreatedAt: eventCreatedAt.text,
      eventCreatedAtEpoch: eventCreatedAt.epoch,
      replayOriginalEventId: normalizedReplayOriginalEventId,
      uid,
      counter,
      authStatus,
      replayStatus,
      productState,
      tamperStatus,
      tamperOpened: row.tamper_opened === true,
      manifestTagLifecycleState: normalizedText(row.manifest_tag_lifecycle_state).toLowerCase(),
      isReplay,
      isAuthentic,
      isClosed,
      isElectronicOpened,
      isOpened,
    });
  }

  const byUid = new Map<string, NormalizedDiagnostic[]>();
  for (const row of normalized) {
    const rows = byUid.get(row.uid) || [];
    rows.push(row);
    byUid.set(row.uid, rows);
  }

  const authenticGroups = [...byUid.values()].filter((rows) => rows.some((row) => row.isAuthentic));
  if (authenticGroups.length < requiredTags) {
    return {
      ok: false as const,
      reason: "qa_unique_manifest_uids_required",
      requiredTags,
      receivedTags: authenticGroups.length,
    };
  }
  if (input.requiresTtstatus) {
    const closedGroups = [...byUid.values()].filter((rows) => rows.some((row) => row.isClosed));
    if (closedGroups.length < requiredTags) {
      return {
        ok: false as const,
        reason: "qa_tt_closed_samples_required",
        requiredTags,
        receivedTags: closedGroups.length,
      };
    }
  }

  const pairs: Array<{ accepted: NormalizedDiagnostic; replay: NormalizedDiagnostic }> = [];
  for (const rows of byUid.values()) {
    const accepted = sortNewestFirst(rows.filter((row) => input.requiresTtstatus ? row.isClosed : row.isAuthentic));
    const replays = sortNewestFirst(rows.filter((row) => row.isReplay));
    const matched = accepted
      .map((candidate) => ({
        accepted: candidate,
        replay: replays.find((row) => row.counter === candidate.counter
          && row.replayOriginalEventId === candidate.eventId
          && row.eventId > candidate.eventId
          && row.eventCreatedAtEpoch > candidate.eventCreatedAtEpoch),
      }))
      .find((candidate) => candidate.replay);
    if (matched?.replay) pairs.push({ accepted: matched.accepted, replay: matched.replay });
  }
  if (pairs.length < requiredTags) {
    return {
      ok: false as const,
      reason: "qa_replay_pair_required",
      requiredTags,
      receivedTags: pairs.length,
    };
  }

  const sortedPairs = pairs
    .sort((a, b) => fingerprintUid(expectedBid, a.accepted.uid).localeCompare(fingerprintUid(expectedBid, b.accepted.uid)));
  let selectedPairs = sortedPairs.slice(0, requiredTags);
  let tamperTransition: Record<string, unknown> | null = null;
  if (input.requiresTtstatus) {
    let openedWithoutRevocation = false;
    let tamperPair: { accepted: NormalizedDiagnostic; replay: NormalizedDiagnostic } | null = null;
    for (const pair of sortedPairs) {
      const laterElectronicOpenings = sortNewestFirst((byUid.get(pair.accepted.uid) || []).filter(
        (row) => row.isElectronicOpened
          && row.counter > pair.accepted.counter
          && row.eventId > pair.accepted.eventId
          && row.eventCreatedAtEpoch > pair.accepted.eventCreatedAtEpoch,
      ));
      const opened = laterElectronicOpenings.find((row) => row.isOpened);
      if (!opened && laterElectronicOpenings.length) openedWithoutRevocation = true;
      if (!opened) continue;
      tamperPair = pair;
      tamperTransition = {
        batch_scoped_uid_fingerprint: fingerprintUid(expectedBid, pair.accepted.uid),
        closed_diagnostic_id: pair.accepted.diagnosticId,
        closed_canonical_event_id: pair.accepted.eventId,
        closed_reference_hash: pair.accepted.referenceHash,
        closed_counter: pair.accepted.counter,
        opened_diagnostic_id: opened.diagnosticId,
        opened_canonical_event_id: opened.eventId,
        opened_reference_hash: opened.referenceHash,
        opened_counter: opened.counter,
        opened_product_state: opened.productState,
        sacrificial_tag_lifecycle_state: opened.manifestTagLifecycleState,
      };
      break;
    }
    if (!tamperTransition) {
      return {
        ok: false as const,
        reason: openedWithoutRevocation
          ? "qa_tt_sacrificial_tag_must_be_revoked"
          : "qa_tt_opened_transition_required",
        requiredTags,
        receivedTags: 0,
      };
    }
    if (tamperPair && !selectedPairs.includes(tamperPair)) {
      selectedPairs = [
        tamperPair,
        ...sortedPairs.filter((pair) => pair !== tamperPair).slice(0, requiredTags - 1),
      ].sort((a, b) => fingerprintUid(expectedBid, a.accepted.uid).localeCompare(fingerprintUid(expectedBid, b.accepted.uid)));
    }
  }

  const evidence = {
    schema_version: SUPPLIER_QA_SUN_EVIDENCE_VERSION,
    evidence_source: "server_derived_sun_diagnostics",
    server_verified_sun_evidence: true,
    physical_ceremony_required: true,
    physical_ceremony_verified: false,
    expected_bid: expectedBid,
    manifest_hash: manifestHash,
    carrier_profile_code: carrierProfileCode,
    key_fingerprint: keyFingerprint || null,
    carrier_config_digest: carrierConfigDigest,
    verification_context_digest: verificationContextDigest,
    required_manifest_uids: requiredTags,
    qualified_manifest_uids: selectedPairs.length,
    diagnostic_reference_hashes: input.references.map((reference) => reference.referenceHash).sort(),
    diagnostic_ids: input.references.map((reference) => reference.diagnosticId).sort((a, b) => a - b),
    batch_scoped_uid_fingerprints: selectedPairs
      .map((pair) => fingerprintUid(expectedBid, pair.accepted.uid))
      .sort(),
    accepted_receipts: selectedPairs.map((pair) => receipt(pair.accepted, expectedBid)),
    replay_receipts: selectedPairs.map((pair) => receipt(pair.replay, expectedBid)),
    tamper_transition: tamperTransition,
    manifest_imported_at: manifestImportedAt.text,
    evidence_evaluated_at: evaluatedAt.text,
    evidence_ttl_hours: SUPPLIER_QA_EVIDENCE_TTL_MS / (60 * 60 * 1000),
    replay_verified: true,
    ttstatus_verified: input.requiresTtstatus,
  };
  return {
    ok: true as const,
    sampleCount: selectedPairs.length,
    diagnosticCount: input.references.length,
    replayChecked: true,
    ttstatusChecked: input.requiresTtstatus,
    evidence,
    evidenceDigest: hashEvidencePayload(evidence),
  };
}
