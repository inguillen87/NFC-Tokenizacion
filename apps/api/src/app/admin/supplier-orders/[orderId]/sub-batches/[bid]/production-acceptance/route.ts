export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { json } from "../../../../../../../lib/http";
import {
  listSupplierProductionQaPlans,
  submitSupplierProductionQaPlan,
  SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION,
} from "../../../../../../../lib/supplier-production-qa-plan-store";
import {
  buildSupplierProductionQaPlanDraft,
  SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
} from "../../../../../../../lib/supplier-production-qa";
import { listSupplierProductionQaSessions } from "../../../../../../../lib/supplier-production-qa-store";
import {
  canApproveTenantQualityPlan,
  loadRouteScope,
  parseProductionQaBody,
  productionQaFailure,
  requestId,
  requireIdempotencyKey,
  requireProductionQaCapability,
  requireProductionQaOperator,
  safeText,
} from "./_shared";

type RouteParams = { orderId: string; bid: string };

function maskUid(value: unknown) {
  const uid = safeText(value, 64).toUpperCase();
  if (uid.length <= 6) return "***";
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`;
}

function publicSession(session: Awaited<ReturnType<typeof listSupplierProductionQaSessions>>[number]) {
  const {
    selection_seed_ciphertext: _selectionSeedCiphertext,
    challenge_ciphertext: _challengeCiphertext,
    samples,
    ...publicFields
  } = session;
  return {
    ...publicFields,
    samples: samples.map((sample) => ({
      tag_id: sample.tag_id,
      uid_masked: maskUid(sample.uid_hex),
      uid_fingerprint: sample.uid_fingerprint,
      ordinal: sample.ordinal,
      stratum_key: sample.stratum_key,
      stratum_values: sample.stratum_values,
      selection_rank: sample.selection_rank,
      cryptographic_required: sample.cryptographic_required,
    })),
  };
}

function stateResponse(input: {
  scope: Awaited<ReturnType<typeof loadRouteScope>>["scope"] & {};
  plans: Awaited<ReturnType<typeof listSupplierProductionQaPlans>>;
  sessions: Awaited<ReturnType<typeof listSupplierProductionQaSessions>>;
  canApprove: boolean;
}) {
  const latestPlan = input.plans[0] || null;
  const approvedPlan = input.plans.find((plan) => plan.decision_status === "approved") || null;
  const latestSession = input.sessions[0] || null;
  const accepted = input.sessions.find((session) => session.decision_status === "passed") || null;
  const blockers: string[] = [];
  let nextAction = "submit_tenant_quality_plan";
  if (!latestPlan) blockers.push("tenant_quality_plan_required");
  else if (!latestPlan.decision_status) {
    blockers.push("tenant_quality_approval_required");
    nextAction = "tenant_quality_decision";
  } else if (latestPlan.decision_status === "rejected") {
    blockers.push("tenant_quality_plan_rejected");
    nextAction = "submit_revised_tenant_quality_plan";
  } else if (input.scope.manifest_status !== "imported") {
    blockers.push("production_manifest_required");
    nextAction = input.scope.key_export_count === 0
      ? "export_approved_production_pack"
      : "import_production_manifest";
  } else if (!latestSession) {
    blockers.push("receiving_qa_session_required");
    nextAction = "open_receiving_qa_session";
  } else if (!latestSession.decision_id && Date.parse(latestSession.expires_at) <= Date.now()) {
    blockers.push("receiving_qa_session_expired");
    nextAction = "open_replacement_receiving_qa_session";
  } else if (!latestSession.decision_id) {
    blockers.push("receiving_qa_evidence_incomplete");
    nextAction = "record_selected_sample_and_finalize";
  } else if (latestSession.decision_status === "failed") {
    blockers.push("production_lot_quarantined");
    nextAction = "disposition_or_rework_lot";
  } else if (accepted) {
    blockers.push("atomic_activation_v2_not_implemented");
    nextAction = "await_atomic_activation_writer";
  }
  return {
    schema_version: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
    scope: input.scope,
    manufacturing_state: input.scope.manufacturing_state,
    latest_plan: latestPlan,
    approved_plan: approvedPlan,
    sessions: input.sessions.map(publicSession),
    accepted_receipt: accepted ? publicSession(accepted) : null,
    permissions: {
      can_approve_tenant_quality_plan: input.canApprove,
      approval_permission: SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION,
    },
    blockers,
    next_action: nextAction,
    activation_allowed: false,
    activation_contract: "atomic-production-activation/v2-pending",
    truth_notice: "NexID no define el AQL. El plan fue suministrado y aprobado por Calidad del tenant.",
  };
}

export async function GET(req: Request, { params }: { params: Promise<RouteParams> }) {
  const operator = await requireProductionQaOperator(req);
  if (operator.response) return operator.response;
  const capability = await requireProductionQaCapability();
  if (capability) return capability;
  const { orderId, bid } = await params;
  const loaded = await loadRouteScope({ orderId, bid, forcedTenantSlug: operator.forcedTenantSlug });
  if (loaded.response) return loaded.response;
  try {
    const [plans, sessions] = await Promise.all([
      listSupplierProductionQaPlans({
        tenantId: loaded.scope.tenant_id,
        supplierOrderId: loaded.scope.supplier_order_id,
        bid: loaded.scope.bid,
      }),
      listSupplierProductionQaSessions({
        tenantId: loaded.scope.tenant_id,
        supplierOrderId: loaded.scope.supplier_order_id,
        bid: loaded.scope.bid,
      }),
    ]);
    return json({
      ok: true,
      production_acceptance: stateResponse({
        scope: loaded.scope,
        plans,
        sessions,
        canApprove: canApproveTenantQualityPlan(operator.principal),
      }),
    });
  } catch (error) {
    return productionQaFailure(error);
  }
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
    "tenant_id", "actor_id", "auth_session_id", "plan_id", "revision",
    "approved_by", "approved_at", "approval_status", "decision_status",
  ].some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    return json({ ok: false, reason: "supplier_production_qa_server_owned_fields_forbidden" }, 400);
  }
  const { orderId, bid } = await params;
  const loaded = await loadRouteScope({ orderId, bid, forcedTenantSlug: operator.forcedTenantSlug });
  if (loaded.response) return loaded.response;
  if (!new Set(["ntag424_dna", "ntag424_dna_tt"]).has(loaded.scope.carrier_profile_code)) {
    return json({
      ok: false,
      reason: "supplier_production_qa_carrier_not_supported",
      carrier_profile_code: loaded.scope.carrier_profile_code,
    }, 409);
  }
  try {
    const priorPlans = await listSupplierProductionQaPlans({
      tenantId: loaded.scope.tenant_id,
      supplierOrderId: loaded.scope.supplier_order_id,
      bid: loaded.scope.bid,
    });
    const priorOperation = priorPlans.find(
      (plan) => plan.operation_key === idempotency.operationKey,
    );
    const revision = priorOperation?.revision ?? ((priorPlans[0]?.revision || 0) + 1);
    const draft = buildSupplierProductionQaPlanDraft({
      tenantId: loaded.scope.tenant_id,
      supplierOrderId: loaded.scope.supplier_order_id,
      supplierSubBatchId: loaded.scope.supplier_sub_batch_id,
      batchId: loaded.scope.batch_id,
      bid: loaded.scope.bid,
      revision,
      lotSize: loaded.scope.expected_quantity,
      inspectionLevel: body.inspection_level ?? body.inspectionLevel,
      targetAql: body.target_aql ?? body.targetAql,
      sampleSize: body.sample_size ?? body.sampleSize,
      acceptNumber: body.accept_number ?? body.acceptNumber,
      rejectNumber: body.reject_number ?? body.rejectNumber,
      policyReference: body.policy_reference ?? body.policyReference,
      policyDocumentSha256: body.policy_document_sha256 ?? body.policyDocumentSha256,
      stratificationDimension: body.stratification_dimension ?? body.stratificationDimension,
    });
    const receipt = await submitSupplierProductionQaPlan({
      planId: randomUUID(),
      tenantId: loaded.scope.tenant_id,
      supplierOrderId: loaded.scope.supplier_order_id,
      supplierSubBatchId: loaded.scope.supplier_sub_batch_id,
      batchId: loaded.scope.batch_id,
      bid: loaded.scope.bid,
      operationKey: idempotency.operationKey,
      revision,
      lotSize: draft.binding.lot_size,
      inspectionLevel: draft.binding.inspection_level,
      targetAql: draft.binding.target_aql,
      sampleSize: draft.binding.sample_size,
      acceptNumber: draft.binding.accept_number,
      rejectNumber: draft.binding.reject_number,
      policyReference: draft.binding.policy_reference,
      policyDocumentSha256: draft.binding.policy_document_sha256,
      stratificationDimension: draft.binding.stratification_dimension,
      cryptographicSampleSize: draft.binding.cryptographic_sample_size,
      planBinding: draft.binding,
      planCanonical: draft.canonical,
      planDigest: draft.digest,
      actorId: operator.actor.id,
      authSessionId: operator.actor.sessionId,
      requestId: requestId(req),
    });
    return json({
      ok: true,
      plan: receipt,
      approval_required: true,
      approval_permission: SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION,
      truth_notice: "NexID validó coherencia, pero no eligió ni aprobó el AQL del tenant.",
    }, receipt.idempotentReplay ? 200 : 201);
  } catch (error) {
    return productionQaFailure(error);
  }
}
