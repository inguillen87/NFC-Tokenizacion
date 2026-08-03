export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { json } from "../../../../../../../../../../lib/http";
import {
  decideSupplierProductionQaPlan,
  listSupplierProductionQaPlans,
} from "../../../../../../../../../../lib/supplier-production-qa-plan-store";
import {
  loadRouteScope,
  parseProductionQaBody,
  productionQaFailure,
  requestId,
  requireIdempotencyKey,
  requireProductionQaCapability,
  requireTenantQualityApprover,
  safeText,
  UUID_PATTERN,
} from "../../../_shared";

type RouteParams = { orderId: string; bid: string; planId: string };

export async function POST(req: Request, { params }: { params: Promise<RouteParams> }) {
  const approver = await requireTenantQualityApprover(req);
  if (approver.response) return approver.response;
  const capability = await requireProductionQaCapability();
  if (capability) return capability;
  const idempotency = requireIdempotencyKey(req);
  if (idempotency.response) return idempotency.response;
  const parsed = await parseProductionQaBody(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if ([
    "tenant_id", "actor_id", "auth_session_id", "decided_by", "decided_at",
    "approved_by", "approved_at", "plan_digest",
  ].some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    return json({ ok: false, reason: "supplier_production_qa_server_owned_fields_forbidden" }, 400);
  }
  const { orderId, bid, planId } = await params;
  if (!UUID_PATTERN.test(planId)) {
    return json({ ok: false, reason: "supplier_production_qa_plan_not_found" }, 404);
  }
  const loaded = await loadRouteScope({ orderId, bid, forcedTenantSlug: approver.forcedTenantSlug });
  if (loaded.response) return loaded.response;
  if (approver.principal.tenantId !== loaded.scope.tenant_id) {
    return json({ ok: false, reason: "supplier_production_qa_plan_tenant_mismatch" }, 403);
  }
  const decisionRaw = safeText(body.decision ?? body.decision_status, 32).toLowerCase();
  const decisionStatus = decisionRaw === "approve" || decisionRaw === "approved"
    ? "approved" as const
    : decisionRaw === "reject" || decisionRaw === "rejected"
      ? "rejected" as const
      : null;
  if (!decisionStatus) {
    return json({ ok: false, reason: "supplier_production_qa_plan_decision_required" }, 400);
  }
  const reason = safeText(body.reason, 1_001);
  const approvalEvidenceRef = safeText(
    body.approval_evidence_ref ?? body.approvalEvidenceRef,
    2_049,
  );
  const approvalEvidenceSha256 = safeText(
    body.approval_evidence_sha256 ?? body.approvalEvidenceSha256,
    80,
  ).toLowerCase();
  if (reason.length < 16 || approvalEvidenceRef.length < 3
    || !/^sha256:[0-9a-f]{64}$/.test(approvalEvidenceSha256)) {
    return json({
      ok: false,
      reason: "supplier_production_qa_plan_decision_evidence_required",
      fields: ["reason", "approval_evidence_ref", "approval_evidence_sha256"],
    }, 400);
  }
  try {
    const plans = await listSupplierProductionQaPlans({
      tenantId: loaded.scope.tenant_id,
      supplierOrderId: loaded.scope.supplier_order_id,
      bid: loaded.scope.bid,
    });
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return json({ ok: false, reason: "supplier_production_qa_plan_not_found" }, 404);
    const receipt = await decideSupplierProductionQaPlan({
      decisionId: randomUUID(),
      planId: plan.id,
      tenantId: loaded.scope.tenant_id,
      operationKey: idempotency.operationKey,
      decisionStatus,
      reason,
      approvalEvidenceRef,
      approvalEvidenceSha256,
      planDigest: plan.plan_digest,
      actorId: approver.actor.id,
      authSessionId: approver.actor.sessionId,
      requestId: requestId(req),
    });
    return json({
      ok: true,
      decision: receipt,
      plan_id: plan.id,
      plan_digest: plan.plan_digest,
      tenant_quality_principal: approver.actor.email,
      truth_notice: "La decisión pertenece al principal de Calidad del tenant; NexID no definió el AQL.",
    }, receipt.idempotentReplay ? 200 : 201);
  } catch (error) {
    return productionQaFailure(error);
  }
}
