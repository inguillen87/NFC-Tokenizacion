import {
  checkAdminWithPermission,
  getAdminActor,
  getAdminPrincipal,
  getAdminTenantScope,
  type AdminPrincipal,
} from "../../../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../../../lib/bounded-request-body";
import {
  adminCriticalRateLimitIdentity,
  enforceCriticalRateLimit,
} from "../../../../../../../lib/critical-rate-limit";
import { json } from "../../../../../../../lib/http";
import { permissionMatches } from "../../../../../../../lib/permission-matcher.js";
import { validSupplierQaIdempotencyKey } from "../../../../../../../lib/supplier-qa-commit";
import {
  SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION,
} from "../../../../../../../lib/supplier-production-qa-plan-store";
import {
  hasSupplierProductionQaV1,
  SUPPLIER_PRODUCTION_QA_MIGRATION,
  supplierProductionQaError,
} from "../../../../../../../lib/supplier-production-qa-store";
import { loadSupplierProductionQaScope } from "../../../../../../../lib/supplier-production-qa-scope";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_PRODUCTION_QA_BODY_BYTES = 512 * 1024;

export function safeText(value: unknown, maxLength = 2_048) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function requestId(req: Request) {
  return safeText(req.headers.get("x-request-id"), 160) || null;
}

export function isProductionQaMutationMethod(method: unknown) {
  const normalizedMethod = String(method || "").trim().toUpperCase();
  return normalizedMethod !== "GET" && normalizedMethod !== "HEAD";
}

async function requireProductionQaMutationRateLimit(req: Request) {
  if (!isProductionQaMutationMethod(req.method)) return null;
  return enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
}

export async function requireProductionQaOperator(req: Request) {
  const auth = await checkAdminWithPermission(req, "qa.approve");
  if (auth) return { response: auth } as const;
  const rateLimited = await requireProductionQaMutationRateLimit(req);
  if (rateLimited) return { response: rateLimited } as const;
  return {
    response: null,
    actor: getAdminActor(req),
    principal: getAdminPrincipal(req),
    forcedTenantSlug: getAdminTenantScope(req).forcedTenantSlug,
  } as const;
}

export function canApproveTenantQualityPlan(principal: AdminPrincipal) {
  return (principal.role === "tenant-owner" || principal.role === "tenant-admin")
    && Boolean(principal.tenantId && principal.tenantSlug)
    && principal.mfaVerified
    && permissionMatches(
      principal.permissions,
      SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION,
      principal.deniedPermissions,
    );
}

export async function requireTenantQualityApprover(req: Request) {
  const auth = await checkAdminWithPermission(req, SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION);
  if (auth) return { response: auth } as const;
  const principal = getAdminPrincipal(req);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  if ((principal.role !== "tenant-owner" && principal.role !== "tenant-admin")
    || !principal.tenantId || !forcedTenantSlug) {
    return {
      response: json({ ok: false, reason: "tenant_quality_principal_required" }, 403),
    } as const;
  }
  if (!principal.mfaVerified) {
    return {
      response: json({
        ok: false,
        reason: "supplier_production_qa_plan_approval_mfa_required",
      }, 403),
    } as const;
  }
  const rateLimited = await requireProductionQaMutationRateLimit(req);
  if (rateLimited) return { response: rateLimited } as const;
  return {
    response: null,
    actor: getAdminActor(req),
    principal,
    forcedTenantSlug,
  } as const;
}

export async function parseProductionQaBody(req: Request) {
  try {
    return {
      body: await readBoundedJsonBody<Record<string, unknown>>(req, MAX_PRODUCTION_QA_BODY_BYTES),
      response: null,
    } as const;
  } catch (error) {
    return {
      body: null,
      response: json({
        ok: false,
        reason: error instanceof RequestBodyTooLargeError
          ? "request_body_too_large"
          : "invalid_json_body",
      }, error instanceof RequestBodyTooLargeError ? 413 : 400),
    } as const;
  }
}

export function requireIdempotencyKey(req: Request) {
  const operationKey = safeText(req.headers.get("idempotency-key"), 128);
  if (!validSupplierQaIdempotencyKey(operationKey)) {
    return {
      operationKey: "",
      response: json({
        ok: false,
        reason: "idempotency_key_required",
        message: "Send one 8-128 character Idempotency-Key and reuse it only for an exact retry.",
      }, 400),
    } as const;
  }
  return { operationKey, response: null } as const;
}

export async function requireProductionQaCapability() {
  try {
    if (await hasSupplierProductionQaV1()) return null;
  } catch {
    // Return the same fail-closed response for an absent or unreadable gate.
  }
  return json({
    ok: false,
    reason: "supplier_production_qa_migration_required",
    required_migration: SUPPLIER_PRODUCTION_QA_MIGRATION,
  }, 503);
}

export async function loadRouteScope(input: {
  orderId: string;
  bid: string;
  forcedTenantSlug?: string | null;
}) {
  if (!UUID_PATTERN.test(input.orderId) || !safeText(input.bid, 160)) {
    return {
      scope: null,
      response: json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404),
    } as const;
  }
  const scope = await loadSupplierProductionQaScope({
    supplierOrderId: input.orderId,
    bid: input.bid,
    forcedTenantSlug: input.forcedTenantSlug,
  });
  if (!scope) {
    return {
      scope: null,
      response: json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404),
    } as const;
  }
  if (scope.effective_pack_purpose !== "production") {
    return {
      scope: null,
      response: json({
        ok: false,
        reason: "supplier_production_qa_scope_required",
        effective_pack_purpose: scope.effective_pack_purpose,
      }, 409),
    } as const;
  }
  return { scope, response: null } as const;
}

export function productionQaFailure(error: unknown) {
  const normalized = supplierProductionQaError(error);
  return json({
    ok: false,
    reason: normalized.reason,
    ...(normalized.requiredMigration ? { required_migration: normalized.requiredMigration } : {}),
  }, normalized.status);
}
