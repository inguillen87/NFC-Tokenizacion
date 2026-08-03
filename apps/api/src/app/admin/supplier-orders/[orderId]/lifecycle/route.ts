export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { json } from "../../../../../lib/http";
import { auditFreeformValuesAreSafe } from "../../../../../lib/audit-freeform-secret-policy";
import {
  hasSupplierOrderLifecycleV1,
  SUPPLIER_ORDER_LIFECYCLE_CHANNELS,
  SUPPLIER_ORDER_LIFECYCLE_MIGRATION,
  supplierOrderLifecycleError,
  transitionSupplierOrderLifecycleV1,
  validSupplierOrderLifecycleOperationKey,
  type SupplierOrderLifecycleTransition,
} from "../../../../../lib/supplier-order-lifecycle";

const MAX_LIFECYCLE_BODY_BYTES = 32 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactText(value: unknown) {
  return String(value || "").trim();
}

function transitionMessage(transition: SupplierOrderLifecycleTransition, packPurpose: string) {
  if (transition === "mark_sent") {
    return "Factory dispatch recorded from the one-time encrypted-pack receipt. This does not prove factory receipt, encoding quality, or physical delivery.";
  }
  return packPurpose === "trial_integration"
    ? "Tenant handover recorded for a NON_SELLABLE integration trial. Tags remain inactive; this is not contractual acceptance or production release."
    : "Tenant handover recorded after independent production QA and complete activation. This records operational delivery evidence; it is not contractual acceptance or proof of physical presence.";
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (limited) return limited;
  if (!getAdminPrincipal(req).mfaVerified) {
    return json({ ok: false, reason: "supplier_order_lifecycle_mfa_required" }, 403);
  }

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  const operationKey = exactText(req.headers.get("idempotency-key"));
  if (!validSupplierOrderLifecycleOperationKey(operationKey)) {
    return json({
      ok: false,
      reason: "supplier_order_lifecycle_idempotency_key_required",
      message: "Send an Idempotency-Key with 8-128 safe characters and reuse it only for an exact retry.",
    }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_LIFECYCLE_BODY_BYTES);
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
      ...(error instanceof RequestBodyTooLargeError ? { max_bytes: MAX_LIFECYCLE_BODY_BYTES } : {}),
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }

  const transition = exactText(body.transition || body.action).toLowerCase() as SupplierOrderLifecycleTransition;
  const recipientRef = exactText(body.recipient_ref ?? body.recipientRef);
  const deliveryChannel = exactText(body.delivery_channel ?? body.deliveryChannel).toLowerCase();
  const evidenceRef = exactText(body.evidence_ref ?? body.evidenceRef);
  const reason = exactText(body.reason);
  if (!auditFreeformValuesAreSafe([recipientRef, evidenceRef, reason])) {
    return json({ ok: false, reason: "supplier_order_lifecycle_sensitive_audit_input_rejected" }, 400);
  }
  if (!["mark_sent", "record_tenant_handover"].includes(transition)
    || recipientRef.length < 3 || recipientRef.length > 200
    || !SUPPLIER_ORDER_LIFECYCLE_CHANNELS.includes(deliveryChannel as typeof SUPPLIER_ORDER_LIFECYCLE_CHANNELS[number])
    || evidenceRef.length < 3 || evidenceRef.length > 500
    || reason.length < 16 || reason.length > 1_000) {
    return json({
      ok: false,
      reason: "supplier_order_lifecycle_payload_invalid",
      required: {
        transition: ["mark_sent", "record_tenant_handover"],
        recipient_ref: "3-200 characters",
        delivery_channel: SUPPLIER_ORDER_LIFECYCLE_CHANNELS,
        evidence_ref: "3-500 characters; reference only, never paste pack passwords or raw NFC keys",
        reason: "16-1000 characters",
      },
    }, 400);
  }

  let lifecycleAvailable = false;
  try {
    lifecycleAvailable = await hasSupplierOrderLifecycleV1();
  } catch {
    lifecycleAvailable = false;
  }
  if (!lifecycleAvailable) {
    return json({
      ok: false,
      reason: "supplier_order_lifecycle_migration_required",
      required_migration: SUPPLIER_ORDER_LIFECYCLE_MIGRATION,
    }, 503);
  }

  const actor = getAdminActor(req);
  try {
    const receipt = await transitionSupplierOrderLifecycleV1({
      supplierOrderId: orderId,
      transition,
      operationKey,
      recipientRef,
      deliveryChannel: deliveryChannel as typeof SUPPLIER_ORDER_LIFECYCLE_CHANNELS[number],
      evidenceRef,
      reason,
      actorId: actor.id,
      authSessionId: actor.sessionId,
      requestId: req.headers.get("x-request-id"),
      userAgent: req.headers.get("user-agent"),
    });
    return json({
      ok: true,
      receipt,
      message: transitionMessage(transition, receipt.pack_purpose),
      truth: {
        tenant_acceptance_claimed: false,
        physical_handover_verified: false,
        qa_override: false,
        activation_override: false,
        raw_nfc_keys_in_receipt: false,
      },
    });
  } catch (error) {
    const mapped = supplierOrderLifecycleError(error);
    return json({
      ok: false,
      reason: mapped.reason,
      ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
    }, mapped.status);
  }
}
