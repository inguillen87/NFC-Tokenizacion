export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdmin,
  getAdminPrincipal,
  type AdminPrincipal,
} from "../../../../../lib/auth";
import { logAuditEvent, type AuditLogResult } from "../../../../../lib/audit-logger";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { permissionMatches } from "../../../../../lib/permission-matcher.js";
import {
  persistSupplierPackagingGovernanceDecision,
  SUPPLIER_PACKAGING_DECISION_STATUSES,
  type SupplierPackagingDecisionStatus,
} from "../../../../../lib/supplier-packaging-governance";

const MAX_PACKAGING_DECISION_BODY_BYTES = 256 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_FORBIDDEN_CONTEXT_FIELDS = [
  "tenant",
  "tenant_id",
  "tenantId",
  "tenant_slug",
  "tenantSlug",
  "order_id",
  "orderId",
  "supplier_order_id",
  "supplierOrderId",
  "actor",
  "actor_id",
  "actorId",
  "decided_by",
  "decidedBy",
  "previous_status",
  "previousStatus",
  "previous_revision",
  "previousRevision",
  "spec_revision",
  "specRevision",
  "spec_hash",
  "specHash",
  "carrier_profile_code",
  "carrierProfileCode",
  "validation_snapshot",
  "validationSnapshot",
  "approved_by",
  "approvedBy",
  "approved_at",
  "approvedAt",
] as const;

type PackagingOrderRow = Record<string, any>;

function hasOwn(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function decisionStatus(value: unknown): SupplierPackagingDecisionStatus | null {
  const normalized = String(value || "").trim().toLowerCase();
  return SUPPLIER_PACKAGING_DECISION_STATUSES.includes(normalized as SupplierPackagingDecisionStatus)
    ? normalized as SupplierPackagingDecisionStatus
    : null;
}

function canApprovePackaging(principal: AdminPrincipal) {
  return principal.scope === "super_admin"
    || permissionMatches(principal.permissions, "supplier:approve_packaging");
}

async function loadScopedOrder(orderId: string, principal: AdminPrincipal): Promise<PackagingOrderRow | null> {
  const rows = principal.scope === "super_admin"
    ? await sql/*sql*/`
        SELECT so.*, tenant.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants tenant ON tenant.id = so.tenant_id
        WHERE so.id = ${orderId}::uuid
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT so.*, tenant.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants tenant ON tenant.id = so.tenant_id
        WHERE so.id = ${orderId}::uuid
          AND so.tenant_id = ${principal.tenantId}::uuid
        LIMIT 1
      `;
  return rows[0] || null;
}

function currentGovernance(order: PackagingOrderRow) {
  return {
    status: String(order.packaging_governance_status || "legacy_unverified"),
    spec_revision: Number(order.packaging_spec_revision || 0),
    spec_hash: order.packaging_spec_hash || null,
    spec_snapshot: order.packaging_spec_snapshot || null,
    evidence_refs: order.packaging_evidence_refs || {},
    validation_snapshot: order.packaging_validation_snapshot || null,
    decided_by: order.packaging_decided_by || null,
    decision_reason: order.packaging_decision_reason || null,
    single_operator_override: order.packaging_single_operator_override === true,
    override_reason: order.packaging_override_reason || null,
    updated_at: order.packaging_governance_updated_at || null,
    approved_at: order.packaging_approved_at || null,
    approved_by: order.packaging_approved_by || null,
  };
}

function safeDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown_error";
  const code = String((error as { code?: unknown }).code || "");
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown_error";
}

function infrastructureFailure(error: unknown) {
  const code = safeDatabaseErrorCode(error);
  const migrationMissing = new Set(["42P01", "42703", "42883"]).has(code);
  console.error("[supplier_packaging_infrastructure_failed]", code);
  return migrationMissing
    ? {
        status: 503,
        reason: "supplier_packaging_migration_required",
        required_migration: "20260728143000_0063_supplier_packaging_governance.sql",
      }
    : { status: 503, reason: "supplier_packaging_governance_unavailable" };
}

function knownDecisionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const infrastructureCode = safeDatabaseErrorCode(error);
  if (new Set(["42P01", "42703", "42883"]).has(infrastructureCode)) {
    return {
      reason: "supplier_packaging_migration_required",
      status: 503,
      required_migration: "20260728143000_0063_supplier_packaging_governance.sql",
    };
  }
  const conflictCodes = [
    "packaging_spec_revision_not_monotonic",
    "packaging_governance_revision_conflict",
    "packaging_governance_transition_invalid",
    "packaging_governance_decision_snapshot_changed",
    "packaging_governance_submission_required",
    "packaging_approval_separation_required",
    "packaging_single_operator_override_not_applicable",
    "packaging_spec_not_production_ready",
    "packaging_rejection_reason_required",
  ];
  const conflict = conflictCodes.find((code) => message.includes(code));
  if (conflict) return { reason: conflict, status: 409 };
  const evidence = message.match(/packaging_approval_evidence_required(?::[a-z_,]+)?/i)?.[0];
  if (evidence) return { reason: evidence.toLowerCase(), status: 409 };
  const invalid = message.match(/(?:packaging|tenant_id|supplier_order_id|carrier_profile_code)_[a-z0-9_]+_(?:required|invalid|too_long)/i)?.[0];
  if (invalid) return { reason: invalid.toLowerCase(), status: 400 };
  console.error("[supplier_packaging_decision_failed]", infrastructureCode);
  return { reason: "packaging_governance_decision_failed", status: 500 };
}

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  let order: PackagingOrderRow | null;
  let history;
  try {
    order = await loadScopedOrder(orderId, principal);
    if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
    history = await sql/*sql*/`
      SELECT
        id,
        spec_revision,
        previous_status,
        decision_status,
        carrier_profile_code,
        spec_snapshot,
        spec_hash,
        evidence_refs,
        validation_snapshot,
        decided_by,
        decision_reason,
        single_operator_override,
        override_reason,
        decided_at
      FROM supplier_packaging_governance_decisions
      WHERE supplier_order_id = ${order.id}
        AND tenant_id = ${order.tenant_id}
      ORDER BY spec_revision DESC
      LIMIT 100
    `;
  } catch (error) {
    const failure = infrastructureFailure(error);
    return json({ ok: false, ...failure }, failure.status);
  }

  return json({
    ok: true,
    order: {
      id: order.id,
      tenant_id: order.tenant_id,
      tenant_slug: order.tenant_slug,
      order_name: order.order_name,
      carrier_profile_code: order.carrier_profile_code,
    },
    governance: currentGovernance(order),
    history,
    permissions: {
      can_draft: true,
      can_submit: true,
      can_approve_or_reject: canApprovePackaging(principal),
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_PACKAGING_DECISION_BODY_BYTES);
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const forgedFields = CLIENT_FORBIDDEN_CONTEXT_FIELDS.filter((field) => hasOwn(body, field));
  if (forgedFields.length) {
    return json({
      ok: false,
      reason: "packaging_context_fields_server_derived",
      rejected_fields: forgedFields,
    }, 400);
  }

  const status = decisionStatus(body.status ?? body.decision);
  if (!status) return json({ ok: false, reason: "packaging_decision_status_invalid" }, 400);
  if ((status === "approved" || status === "rejected") && !canApprovePackaging(principal)) {
    return json({
      ok: false,
      reason: "supplier_packaging_approval_forbidden",
      required_permission: "supplier:approve_packaging",
    }, 403);
  }

  const singleOperatorOverride = body.single_operator_override === true || body.singleOperatorOverride === true;
  const overrideReason = String(body.override_reason ?? body.overrideReason ?? "").trim();
  if ((singleOperatorOverride && !overrideReason) || (!singleOperatorOverride && overrideReason)) {
    return json({
      ok: false,
      reason: "packaging_single_operator_override_reason_required",
    }, 400);
  }
  if (singleOperatorOverride && status !== "approved") {
    return json({ ok: false, reason: "packaging_single_operator_override_not_applicable" }, 400);
  }
  if ((status === "approved" || status === "rejected") && (hasOwn(body, "spec") || hasOwn(body, "packaging_spec"))) {
    return json({
      ok: false,
      reason: "packaging_decision_snapshot_server_derived",
      message: "Approval and rejection always use the currently submitted immutable snapshot.",
    }, 400);
  }

  let order: PackagingOrderRow | null;
  try {
    order = await loadScopedOrder(orderId, principal);
  } catch (error) {
    const failure = infrastructureFailure(error);
    return json({ ok: false, ...failure }, failure.status);
  }
  if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  const spec = status === "approved" || status === "rejected"
    ? order.packaging_spec_snapshot
    : body.spec ?? body.packaging_spec ?? order.packaging_spec_snapshot;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return json({ ok: false, reason: "packaging_spec_required" }, 400);
  }
  const evidenceRefs = body.evidence_refs
    ?? body.evidenceRefs
    ?? order.packaging_evidence_refs
    ?? {};

  let persisted;
  try {
    persisted = await persistSupplierPackagingGovernanceDecision({
      tenantId: order.tenant_id,
      supplierOrderId: order.id,
      previousStatus: order.packaging_governance_status || "legacy_unverified",
      status,
      previousRevision: Number(order.packaging_spec_revision || 0),
      specRevision: Number(order.packaging_spec_revision || 0) + 1,
      carrierProfileCode: order.carrier_profile_code,
      spec,
      evidenceRefs,
      decidedBy: principal.userId,
      decisionReason: body.decision_reason ?? body.decisionReason,
      overrideReason: singleOperatorOverride ? overrideReason : null,
    });
  } catch (error) {
    const failure = knownDecisionError(error);
    return json({
      ok: false,
      reason: failure.reason,
      ...("required_migration" in failure ? { required_migration: failure.required_migration } : {}),
    }, failure.status);
  }

  // Persistence above is the canonical immutable audit record. Everything
  // below is a projection/readback and must never turn a committed decision
  // into an ambiguous failure response that invites a duplicate retry.
  const warnings: string[] = [];
  let updatedOrder: PackagingOrderRow | null = null;
  try {
    updatedOrder = await loadScopedOrder(orderId, principal);
  } catch (error) {
    console.error("[supplier_packaging_readback_failed]", safeDatabaseErrorCode(error));
  }
  if (!updatedOrder) warnings.push("packaging_current_state_readback_unavailable");

  let auditProjection: AuditLogResult = { ok: false, reason: "audit_log_projection_failed" };
  try {
    auditProjection = await logAuditEvent({
      actorId: principal.userId,
      tenantId: String(order.tenant_id),
      action: `supplier_packaging_${status}`,
      resourceType: "supplier_order",
      resourceId: String(order.id),
      beforeData: {
        status: order.packaging_governance_status || "legacy_unverified",
        spec_revision: Number(order.packaging_spec_revision || 0),
        spec_hash: order.packaging_spec_hash || null,
      },
      afterData: {
        status: persisted.status,
        spec_revision: persisted.specRevision,
        spec_hash: persisted.specHash,
        single_operator_override: singleOperatorOverride,
        override_reason_recorded: Boolean(singleOperatorOverride),
      },
      userAgent: req.headers.get("user-agent"),
      requestId: req.headers.get("x-request-id"),
    });
  } catch (error) {
    console.error("[supplier_packaging_audit_projection_failed]", safeDatabaseErrorCode(error));
  }
  if (!auditProjection.ok) warnings.push(auditProjection.reason);

  return json({
    ok: true,
    commit_state: "committed",
    retry_required: false,
    decision: persisted,
    governance: updatedOrder ? currentGovernance(updatedOrder) : {
      status: persisted.status,
      spec_revision: persisted.specRevision,
      spec_hash: persisted.specHash,
      readback_pending: true,
    },
    warnings,
  }, 201);
}
