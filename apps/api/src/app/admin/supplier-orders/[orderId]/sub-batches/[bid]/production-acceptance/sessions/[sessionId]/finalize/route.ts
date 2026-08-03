export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";
import { sql } from "../../../../../../../../../../lib/db";
import { json } from "../../../../../../../../../../lib/http";
import { hashEvidencePayload } from "../../../../../../../../../../lib/proof-layer";
import {
  canonicalSupplierProductionQaJson,
  sha256SupplierProductionQaCanonical,
  SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
} from "../../../../../../../../../../lib/supplier-production-qa";
import {
  commitSupplierProductionQa,
  getSupplierProductionQaSession,
} from "../../../../../../../../../../lib/supplier-production-qa-store";
import {
  buildSupplierProductionQaVerificationContext,
} from "../../../../../../../../../../lib/supplier-production-qa-scope";
import {
  decryptSupplierProductionQaChallenge,
  decryptSupplierProductionQaSeed,
} from "../../../../../../../../../../lib/supplier-production-qa-secrets";
import {
  parseSupplierQaSnapshotReferences,
  SUPPLIER_QA_SUN_EVIDENCE_VERSION,
  validateSupplierQaSunEvidence,
  type SupplierQaDiagnosticRow,
  type SupplierQaSnapshotReference,
} from "../../../../../../../../../../lib/supplier-qa-evidence";
import {
  loadRouteScope,
  parseProductionQaBody,
  productionQaFailure,
  requestId,
  requireIdempotencyKey,
  requireProductionQaCapability,
  requireProductionQaOperator,
  safeText,
  UUID_PATTERN,
} from "../../../_shared";

type RouteParams = { orderId: string; bid: string; sessionId: string };
type NormalizedObservation = {
  tag_id: string;
  outcome: "conforming" | "nonconforming";
  defect_codes: string[];
};

function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeObservations(
  value: unknown,
  expectedTagIds: string[],
): { ok: true; observations: NormalizedObservation[] } | { ok: false; reason: string } {
  if (!Array.isArray(value) || value.length !== expectedTagIds.length || value.length > 5_000) {
    return { ok: false, reason: "supplier_production_qa_observations_incomplete" };
  }
  const observations: NormalizedObservation[] = [];
  for (const rawValue of value) {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      return { ok: false, reason: "supplier_production_qa_observations_invalid" };
    }
    const raw = rawValue as Record<string, unknown>;
    const tagId = safeText(raw.tag_id ?? raw.tagId, 64).toLowerCase();
    const outcome = safeText(raw.outcome, 32).toLowerCase();
    const rawDefects = raw.defect_codes ?? raw.defectCodes ?? [];
    if (!UUID_PATTERN.test(tagId)
      || (outcome !== "conforming" && outcome !== "nonconforming")
      || !Array.isArray(rawDefects) || rawDefects.length > 20) {
      return { ok: false, reason: "supplier_production_qa_observations_invalid" };
    }
    const defectCodes = rawDefects.map((item) => safeText(item, 81)).sort();
    if (defectCodes.some((code) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(code))
      || new Set(defectCodes).size !== defectCodes.length
      || (outcome === "nonconforming" && defectCodes.length === 0)
      || (outcome === "conforming" && defectCodes.length !== 0)) {
      return { ok: false, reason: "supplier_production_qa_observations_invalid" };
    }
    observations.push({
      tag_id: tagId,
      outcome,
      defect_codes: defectCodes,
    });
  }
  observations.sort((left, right) => left.tag_id.localeCompare(right.tag_id));
  const supplied = observations.map((item) => item.tag_id);
  const expected = [...expectedTagIds].map((item) => item.toLowerCase()).sort();
  if (new Set(supplied).size !== supplied.length
    || canonicalSupplierProductionQaJson(supplied) !== canonicalSupplierProductionQaJson(expected)) {
    return { ok: false, reason: "supplier_production_qa_observation_scope_mismatch" };
  }
  return { ok: true, observations };
}

async function loadDiagnosticRows(input: {
  diagnosticIds: number[];
  tenantId: string;
  batchId: string;
}) {
  return sql/*sql*/`
    SELECT
      diagnostic.id,
      diagnostic.trace_id,
      diagnostic.created_at::text AS created_at,
      diagnostic.bid,
      diagnostic.uid_hex,
      diagnostic.read_counter,
      diagnostic.auth_status,
      diagnostic.replay_status,
      diagnostic.product_state,
      diagnostic.tamper_status,
      diagnostic.tamper_opened,
      diagnostic.tagtamper_config_detected,
      diagnostic.request_json->>'evidence_source' AS evidence_source,
      diagnostic.result_json,
      event.id AS event_id,
      event.created_at::text AS event_created_at,
      event.tenant_id::text AS event_tenant_id,
      event.batch_id::text AS event_batch_id,
      event.bid AS event_bid,
      event.uid_hex AS event_uid_hex,
      COALESCE(event.read_counter, event.sdm_read_ctr) AS event_counter,
      event.cmac_ok AS event_cmac_ok,
      event.source::text AS event_source,
      event.result AS event_result,
      event.meta->>'replay_original_event_id' AS replay_original_event_id,
      EXISTS (
        SELECT 1 FROM tags manifest_tag
        WHERE manifest_tag.batch_id = ${input.batchId}::uuid
          AND upper(manifest_tag.uid_hex) = upper(diagnostic.uid_hex)
      ) AS manifest_uid_match,
      (
        SELECT manifest_tag.lifecycle_state::text
        FROM tags manifest_tag
        WHERE manifest_tag.batch_id = ${input.batchId}::uuid
          AND upper(manifest_tag.uid_hex) = upper(diagnostic.uid_hex)
        LIMIT 1
      ) AS manifest_tag_lifecycle_state
    FROM sun_diagnostics diagnostic
    LEFT JOIN events event
      ON event.id = CASE
        WHEN diagnostic.result_json #>> '{raw_result,event_id}' ~ '^[1-9][0-9]*$'
        THEN (diagnostic.result_json #>> '{raw_result,event_id}')::bigint
        ELSE NULL
      END
     AND event.tenant_id = ${input.tenantId}::uuid
     AND event.batch_id = ${input.batchId}::uuid
    WHERE diagnostic.id = ANY(${input.diagnosticIds}::bigint[])
      AND diagnostic.tool_type = 'sun_scan'
  ` as Promise<SupplierQaDiagnosticRow[]>;
}

export async function POST(req: Request, { params }: { params: Promise<RouteParams> }) {
  const operator = await requireProductionQaOperator(req);
  if (operator.response) return operator.response;
  const capability = await requireProductionQaCapability();
  if (capability) return capability;
  const idempotency = requireIdempotencyKey(req);
  if (idempotency.response) return idempotency.response;
  const parsed = await parseProductionQaBody(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if ([
    "status", "passed", "qa_passed", "sample_count", "nonconforming_count",
    "tenant_id", "actor_id", "selection_seed_reveal",
  ].some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    return json({
      ok: false,
      reason: "supplier_production_qa_server_owned_decision_fields_forbidden",
      message: "The server derives pass/fail, counts and the seed reveal from the committed session.",
    }, 400);
  }
  const { orderId, bid, sessionId } = await params;
  if (!UUID_PATTERN.test(sessionId)) {
    return json({ ok: false, reason: "supplier_production_qa_session_not_found" }, 404);
  }
  const loaded = await loadRouteScope({ orderId, bid, forcedTenantSlug: operator.forcedTenantSlug });
  if (loaded.response) return loaded.response;
  const scope = loaded.scope;
  try {
    const session = await getSupplierProductionQaSession({
      tenantId: scope.tenant_id,
      supplierOrderId: scope.supplier_order_id,
      sessionId,
    });
    if (!session || session.bid.toUpperCase() !== scope.bid) {
      return json({ ok: false, reason: "supplier_production_qa_session_not_found" }, 404);
    }
    if (!session.decision_id && Date.parse(session.expires_at) < Date.now()) {
      return json({ ok: false, reason: "supplier_production_qa_session_expired" }, 409);
    }
    const secretContext = { tenantId: session.tenant_id, bid: session.bid, sessionId: session.id };
    const committedChallenge = decryptSupplierProductionQaChallenge(
      session.challenge_ciphertext,
      secretContext,
    );
    const suppliedChallenge = safeText(body.challenge, 129);
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(suppliedChallenge)
      || !equalSecret(committedChallenge, suppliedChallenge)) {
      return json({ ok: false, reason: "supplier_production_qa_challenge_invalid" }, 403);
    }
    const normalized = normalizeObservations(
      body.observations ?? body.production_observations,
      session.samples.map((sample) => sample.tag_id),
    );
    if (!normalized.ok) return json({ ok: false, reason: normalized.reason }, 400);
    const observations = normalized.observations;
    const observationsDigest = sha256SupplierProductionQaCanonical(observations);
    const nonconformingCount = observations.filter((item) => item.outcome === "nonconforming").length;
    const status = nonconformingCount <= session.accept_number ? "passed" as const : "failed" as const;
    const verification = buildSupplierProductionQaVerificationContext(scope);
    if (!verification
      || verification.verificationContextDigest !== session.sun_verification_context_digest) {
      return json({ ok: false, reason: "supplier_production_qa_context_changed" }, 409);
    }
    const notes = safeText(body.notes, 2_001) || null;
    if (notes && notes.length > 2_000) {
      return json({ ok: false, reason: "supplier_qa_notes_too_long" }, 400);
    }
    const notesDigest = notes ? hashEvidencePayload({ notes }) : null;
    const requiresTtstatus = scope.carrier_profile_code === "ntag424_dna_tt";
    const cryptoFingerprints = session.samples
      .filter((sample) => sample.cryptographic_required)
      .map((sample) => sample.uid_fingerprint)
      .sort();
    let verifiedEvidence: Extract<ReturnType<typeof validateSupplierQaSunEvidence>, { ok: true }> | null = null;
    let references: SupplierQaSnapshotReference[] = [];
    if (status === "passed") {
      const rawReferences = Array.isArray(body.snapshot_urls)
        ? body.snapshot_urls
        : Array.isArray(body.snapshotUrls)
          ? body.snapshotUrls
          : [];
      const parsedReferences = parseSupplierQaSnapshotReferences(rawReferences);
      if (!parsedReferences.ok) {
        return json({ ok: false, reason: parsedReferences.reason }, 409);
      }
      const diagnostics = await loadDiagnosticRows({
        diagnosticIds: parsedReferences.references.map((reference) => reference.diagnosticId),
        tenantId: scope.tenant_id,
        batchId: scope.batch_id,
      });
      const evidenceGate = validateSupplierQaSunEvidence({
        references: parsedReferences.references,
        diagnostics,
        expectedBid: scope.bid,
        expectedTenantId: scope.tenant_id,
        expectedBatchId: scope.batch_id,
        expectedQuantity: scope.expected_quantity,
        manifestHash: scope.manifest_hash || "",
        carrierProfileCode: scope.carrier_profile_code,
        keyFingerprint: scope.key_fingerprint,
        carrierConfigDigest: verification.carrierConfigDigest,
        verificationContextDigest: verification.verificationContextDigest,
        manifestImportedAt: scope.manifest_imported_at || "",
        requiresTtstatus,
        requiresSecureSun: true,
        requiredUidFingerprints: cryptoFingerprints,
      });
      if (!evidenceGate.ok) {
        return json({
          ok: false,
          reason: evidenceGate.reason,
          required_crypto_samples: evidenceGate.requiredTags,
          received_crypto_samples: "receivedTags" in evidenceGate ? evidenceGate.receivedTags : undefined,
        }, 409);
      }
      verifiedEvidence = evidenceGate;
      references = parsedReferences.references;
    }

    const seed = decryptSupplierProductionQaSeed(session.selection_seed_ciphertext, secretContext);
    try {
      const selectionSeedReveal = seed.toString("base64url");
      const evidenceBase: Record<string, unknown> = verifiedEvidence
        ? {
            ...verifiedEvidence.evidence,
            sun_evidence_digest: verifiedEvidence.evidenceDigest,
            server_verified_sun_evidence: true,
          }
        : {
            schema_version: SUPPLIER_QA_SUN_EVIDENCE_VERSION,
            evidence_source: "operator_recorded_production_rejection",
            server_verified_sun_evidence: false,
            diagnostic_ids: [],
            diagnostic_reference_hashes: [],
            batch_scoped_uid_fingerprints: [],
          };
      delete evidenceBase.evidence_digest;
      Object.assign(evidenceBase, {
        physical_ceremony_verified: false,
        physical_inspection_recorded: true,
        pack_purpose: "production",
        acceptance_scope: "production_lot",
        commercial_disposition: status === "passed"
          ? "RECEIVING_QA_ACCEPTED_ACTIVATION_BLOCKED"
          : "PRODUCTION_LOT_QUARANTINED",
        activation_allowed: false,
        operation_key: idempotency.operationKey,
        notes_digest: notesDigest,
        notes,
        checked_by: operator.actor.email,
        production_session_id: session.id,
        production_acceptance_schema_version: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
        production_plan_id: session.qa_plan_id,
        production_plan_decision_id: session.qa_plan_decision_id,
        production_policy_digest: session.policy_digest,
        production_selection_digest: session.selection_digest,
        production_seed_commitment: session.selection_seed_commitment,
        production_seed_reveal: selectionSeedReveal,
        production_observations_digest: observationsDigest,
        production_acceptance_context_digest: session.acceptance_context_digest,
      });
      const evidenceDigest = hashEvidencePayload(evidenceBase);
      const evidence = { ...evidenceBase, evidence_digest: evidenceDigest };
      const receipt = await commitSupplierProductionQa({
        tenantId: scope.tenant_id,
        supplierOrderId: scope.supplier_order_id,
        supplierSubBatchId: scope.supplier_sub_batch_id,
        batchId: scope.batch_id,
        bid: scope.bid,
        status,
        sampleCount: verifiedEvidence?.sampleCount || 0,
        replayChecked: verifiedEvidence?.replayChecked || false,
        ttstatusChecked: verifiedEvidence?.ttstatusChecked || false,
        notes,
        evidence,
        evidenceDigest,
        diagnosticRefs: references.map((reference) => ({
          diagnostic_id: reference.diagnosticId,
          trace_id: reference.traceId,
          reference_hash: reference.referenceHash,
        })),
        operationKey: idempotency.operationKey,
        actorId: operator.actor.id,
        actorEmail: operator.actor.email,
        expectedManifestHash: scope.manifest_hash || "",
        expectedCarrierProfileCode: scope.carrier_profile_code,
        expectedKeyFingerprint: scope.key_fingerprint,
        expectedSdmConfig: scope.batch_sdm_config,
        expectedVerificationContextDigest: verification.verificationContextDigest,
        expectedVerificationContextBinding: verification.binding,
        expectedVerificationContextCanonical: verification.canonicalPayload,
        userAgent: req.headers.get("user-agent"),
        requestId: requestId(req),
        productionSessionId: session.id,
        productionChallenge: suppliedChallenge,
        selectionSeedReveal,
        productionObservations: observations,
        productionObservationsDigest: observationsDigest,
        authSessionId: operator.actor.sessionId,
      });
      return json({
        ok: true,
        schema_version: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
        session_id: session.id,
        qa_check_id: receipt.qaCheckId,
        decision_id: receipt.decisionId,
        qa_status: receipt.status,
        disposition: receipt.disposition,
        observed_sample_count: receipt.observedSampleCount,
        nonconforming_count: receipt.nonconformingCount,
        evidence_digest: receipt.evidenceDigest,
        evidence_event_hash: receipt.evidenceEventHash,
        selection_seed_reveal: selectionSeedReveal,
        idempotent_replay: receipt.idempotentReplay,
        manufacturing_state: receipt.status === "passed"
          ? "RECEIVING_QA_PASSED"
          : "PRODUCTION_MANIFEST_IMPORTED",
        activation_allowed: false,
        activation_gate: "atomic-production-activation/v2-pending",
      });
    } finally {
      seed.fill(0);
    }
  } catch (error) {
    return productionQaFailure(error);
  }
}
