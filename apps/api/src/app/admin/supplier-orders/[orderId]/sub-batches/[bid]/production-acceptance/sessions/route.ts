export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomUUID } from "node:crypto";
import { json } from "../../../../../../../../lib/http";
import {
  listSupplierProductionQaPlans,
} from "../../../../../../../../lib/supplier-production-qa-plan-store";
import {
  buildSupplierProductionQaSelection,
  canonicalSupplierProductionQaJson,
  sha256SupplierProductionQaCanonical,
  SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
  SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA,
} from "../../../../../../../../lib/supplier-production-qa";
import {
  createSupplierProductionQaSession,
  findSupplierProductionQaSessionByOperationKey,
  getSupplierProductionQaSession,
} from "../../../../../../../../lib/supplier-production-qa-store";
import {
  buildSupplierProductionQaVerificationContext,
  loadSupplierProductionQaManifestUnits,
} from "../../../../../../../../lib/supplier-production-qa-scope";
import {
  createSupplierProductionQaSecrets,
  decryptSupplierProductionQaChallenge,
} from "../../../../../../../../lib/supplier-production-qa-secrets";
import { supplierQaUidFingerprint } from "../../../../../../../../lib/supplier-qa-evidence";
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
} from "../_shared";

type RouteParams = { orderId: string; bid: string };

function maskUid(uid: string) {
  return uid.length > 8 ? `${uid.slice(0, 4)}…${uid.slice(-4)}` : "***";
}

function publicSessionCeremony(
  session: NonNullable<Awaited<ReturnType<typeof getSupplierProductionQaSession>>>,
  challenge: string,
) {
  return {
    session_id: session.id,
    qa_plan_id: session.qa_plan_id,
    qa_plan_decision_id: session.qa_plan_decision_id,
    expires_at: session.expires_at,
    challenge,
    challenge_hash: session.challenge_hash,
    selection_seed_commitment: session.selection_seed_commitment,
    selection_digest: session.selection_digest,
    acceptance_context_digest: session.acceptance_context_digest,
    sample_size: session.sample_size,
    accept_number: session.accept_number,
    reject_number: session.reject_number,
    samples: session.samples.map((sample) => ({
      tag_id: sample.tag_id,
      ordinal: sample.ordinal,
      uid_masked: maskUid(sample.uid_hex),
      uid_fingerprint: sample.uid_fingerprint,
      stratum_key: sample.stratum_key,
      stratum_values: sample.stratum_values,
      selection_rank: sample.selection_rank,
      cryptographic_required: sample.cryptographic_required,
    })),
    instructions: {
      preserve_challenge_until_finalize: true,
      operator_cannot_choose_sample: true,
      operator_cannot_submit_passed_boolean: true,
      sun_required_only_for_preselected_crypto_sample: true,
    },
  };
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
  const allowedBodyKeys = new Set(["plan_id", "planId"]);
  if (Object.keys(body).some((field) => !allowedBodyKeys.has(field))) {
    return json({
      ok: false,
      reason: "supplier_production_qa_session_server_owned_fields_forbidden",
      message: "Send only plan_id. The server owns TTL, seed, challenge and sample selection.",
    }, 400);
  }
  const planId = safeText(body.plan_id ?? body.planId, 64);
  if (!UUID_PATTERN.test(planId)) {
    return json({ ok: false, reason: "supplier_production_qa_approved_plan_required" }, 400);
  }
  const { orderId, bid } = await params;
  const loaded = await loadRouteScope({ orderId, bid, forcedTenantSlug: operator.forcedTenantSlug });
  if (loaded.response) return loaded.response;
  const scope = loaded.scope;
  try {
    const replay = await findSupplierProductionQaSessionByOperationKey({
      tenantId: scope.tenant_id,
      supplierOrderId: scope.supplier_order_id,
      operationKey: idempotency.operationKey,
    });
    if (replay) {
      if (replay.qa_plan_id !== planId) {
        return json({ ok: false, reason: "supplier_production_qa_idempotency_key_conflict" }, 409);
      }
      const challenge = decryptSupplierProductionQaChallenge(replay.challenge_ciphertext, {
        tenantId: replay.tenant_id,
        bid: replay.bid,
        sessionId: replay.id,
      });
      return json({ ok: true, idempotent_replay: true, session: publicSessionCeremony(replay, challenge) });
    }

    const plans = await listSupplierProductionQaPlans({
      tenantId: scope.tenant_id,
      supplierOrderId: scope.supplier_order_id,
      bid: scope.bid,
    });
    const plan = plans.find((item) => item.id === planId && item.decision_status === "approved");
    if (!plan || !plan.decision_id || !plan.approver_email || !plan.decided_at
      || !plan.approval_evidence_ref || !plan.approval_evidence_sha256) {
      return json({ ok: false, reason: "supplier_production_qa_approved_plan_required" }, 409);
    }
    if (scope.manifest_status !== "imported"
      || scope.manifest_count !== scope.expected_quantity
      || scope.manufacturing_state !== "PRODUCTION_MANIFEST_IMPORTED"
      || !scope.manifest_hash
      || scope.key_export_count !== 1
      || scope.batch_key_export_count !== 1
      || !scope.key_exported_at
      || !scope.batch_key_exported_at
      || scope.packaging_governance_status !== "approved"
      || scope.packaging_spec_revision < 1
      || !scope.packaging_spec_hash
      || !/^sha256:[0-9a-f]{64}$/.test(scope.packaging_spec_hash)
      || scope.carrier_profile_code !== scope.order_carrier_profile_code
      || !new Set(["ntag424_dna", "ntag424_dna_tt"]).has(scope.carrier_profile_code)) {
      return json({
        ok: false,
        reason: "supplier_production_qa_preconditions_not_met",
        manufacturing_state: scope.manufacturing_state,
        manifest_status: scope.manifest_status,
        manifest_count: scope.manifest_count,
        expected_quantity: scope.expected_quantity,
      }, 409);
    }
    const verification = buildSupplierProductionQaVerificationContext(scope);
    if (!verification) {
      return json({ ok: false, reason: "supplier_production_qa_verification_context_incomplete" }, 409);
    }
    const manifestUnits = await loadSupplierProductionQaManifestUnits({
      tenantId: scope.tenant_id,
      batchId: scope.batch_id,
      bid: scope.bid,
    });
    if (manifestUnits.length !== scope.expected_quantity) {
      return json({ ok: false, reason: "supplier_production_qa_manifest_lot_size_mismatch" }, 409);
    }

    const sessionId = randomUUID();
    const secretContext = { tenantId: scope.tenant_id, bid: scope.bid, sessionId };
    const secrets = createSupplierProductionQaSecrets(secretContext);
    try {
      const selection = buildSupplierProductionQaSelection({
        tenantId: scope.tenant_id,
        batchId: scope.batch_id,
        bid: scope.bid,
        manifestHash: scope.manifest_hash,
        qaSessionId: sessionId,
        authoritativePolicyDigest: plan.plan_digest,
        policy: {
          schema: SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA,
          policyId: plan.id,
          policyRevision: plan.revision,
          tenantId: scope.tenant_id,
          approvalStatus: "approved",
          approvedBy: plan.approver_email,
          approvedAt: plan.decided_at,
          approvalEvidenceRef: plan.approval_evidence_ref,
          lotSize: plan.lot_size,
          inspectionLevel: plan.inspection_level,
          targetAql: plan.target_aql,
          sampleSize: plan.sample_size,
          acceptNumber: plan.accept_number,
          rejectNumber: plan.reject_number,
          stratumField: plan.stratification_dimension,
        },
        manifestRows: manifestUnits.map((unit) => ({
          uidHex: unit.uid_hex,
          bid: unit.bid,
          unitMetadata: unit.unit_metadata,
        })),
        serverSeed: secrets.seed,
      });
      const tagByUid = new Map(manifestUnits.map((unit) => [unit.uid_hex, unit]));
      const cryptoSet = new Set([...selection.selectedSample]
        .sort((left, right) => left.selectionRankDigest.localeCompare(right.selectionRankDigest))
        .slice(0, plan.cryptographic_sample_size)
        .map((sample) => sample.uidHex));
      const samples = selection.selectedSample.map((sample, index) => {
        const manifestUnit = tagByUid.get(sample.uidHex);
        if (!manifestUnit) throw new Error("supplier_production_qa_selected_manifest_tag_missing");
        return {
          tag_id: manifestUnit.tag_id,
          ordinal: index + 1,
          uid_fingerprint: supplierQaUidFingerprint(scope.bid, sample.uidHex),
          stratum_key: `${plan.stratification_dimension}:${sample.stratumId}`,
          stratum_values: { [plan.stratification_dimension]: sample.stratumId },
          selection_rank: sample.selectionRankDigest,
          cryptographic_required: cryptoSet.has(sample.uidHex),
        };
      });
      const challengeHash = `sha256:${createHash("sha256")
        .update("supplier-production-qa-challenge/v1", "utf8")
        .update("\0", "utf8")
        .update(secrets.challenge, "utf8")
        .digest("hex")}`;
      const acceptanceBinding = {
        domain: "nexid:supplier-production-acceptance",
        schema_version: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
        tenant_id: scope.tenant_id,
        supplier_order_id: scope.supplier_order_id,
        supplier_sub_batch_id: scope.supplier_sub_batch_id,
        batch_id: scope.batch_id,
        bid: scope.bid,
        qa_plan_id: plan.id,
        qa_plan_decision_id: plan.decision_id,
        qa_plan_digest: plan.plan_digest,
        approval_evidence_sha256: plan.approval_evidence_sha256,
        policy_approved_at: plan.decided_at,
        verification_context_digest: verification.verificationContextDigest,
        manifest_hash: scope.manifest_hash,
        carrier_profile_code: scope.carrier_profile_code,
        key_fingerprint: scope.key_fingerprint,
        packaging_spec_revision: scope.packaging_spec_revision,
        packaging_spec_hash: scope.packaging_spec_hash,
        manufacturing_state_at_open: scope.manufacturing_state,
        selection_algorithm: "hmac-sha256-stratified-v1",
        selection_seed_commitment: selection.seedCommitment,
        population_digest: selection.populationDigest,
        allocation_digest: selection.allocationDigest,
        selection_digest: selection.selectionDigest,
        selection_commitment: selection.selectionCommitment,
        challenge_hash: challengeHash,
      };
      const acceptanceCanonical = canonicalSupplierProductionQaJson(acceptanceBinding);
      const acceptanceDigest = sha256SupplierProductionQaCanonical(acceptanceBinding);
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1_000).toISOString();
      const receipt = await createSupplierProductionQaSession({
        sessionId,
        qaPlanId: plan.id,
        qaPlanDecisionId: plan.decision_id,
        tenantId: scope.tenant_id,
        supplierOrderId: scope.supplier_order_id,
        supplierSubBatchId: scope.supplier_sub_batch_id,
        batchId: scope.batch_id,
        bid: scope.bid,
        operationKey: idempotency.operationKey,
        lotSize: plan.lot_size,
        inspectionLevel: plan.inspection_level,
        targetAql: plan.target_aql,
        sampleSize: plan.sample_size,
        acceptNumber: plan.accept_number,
        rejectNumber: plan.reject_number,
        policyReference: plan.policy_reference,
        policyDocumentSha256: plan.policy_document_sha256,
        policyDigest: plan.plan_digest,
        stratificationDimensions: [plan.stratification_dimension],
        manifestHash: scope.manifest_hash,
        carrierProfileCode: scope.carrier_profile_code,
        keyFingerprint: scope.key_fingerprint,
        packagingSpecRevision: scope.packaging_spec_revision,
        packagingSpecHash: scope.packaging_spec_hash || "",
        manufacturingStateAtOpen: "PRODUCTION_MANIFEST_IMPORTED",
        sunVerificationContextDigest: verification.verificationContextDigest,
        acceptanceContextDigest: acceptanceDigest,
        acceptanceContextBinding: acceptanceBinding,
        acceptanceContextCanonical: acceptanceCanonical,
        selectionSeedCiphertext: secrets.seedCiphertext,
        selectionSeedCommitment: selection.seedCommitment,
        selectionDigest: selection.selectionDigest,
        challengeCiphertext: secrets.challengeCiphertext,
        challengeHash,
        expiresAt,
        samples,
        actorId: operator.actor.id,
        authSessionId: operator.actor.sessionId,
        requestId: requestId(req),
      });
      const stored = await getSupplierProductionQaSession({
        tenantId: scope.tenant_id,
        supplierOrderId: scope.supplier_order_id,
        sessionId: receipt.sessionId,
      });
      if (!stored) throw new Error("supplier_production_qa_session_readback_failed");
      const challenge = receipt.idempotentReplay
        ? decryptSupplierProductionQaChallenge(stored.challenge_ciphertext, {
            tenantId: stored.tenant_id,
            bid: stored.bid,
            sessionId: stored.id,
          })
        : secrets.challenge;
      return json({
        ok: true,
        idempotent_replay: receipt.idempotentReplay,
        session: publicSessionCeremony(stored, challenge),
        secret_custody: "software_application_envelope_not_kms_or_hsm",
      }, receipt.idempotentReplay ? 200 : 201);
    } finally {
      secrets.seed.fill(0);
    }
  } catch (error) {
    return productionQaFailure(error);
  }
}
