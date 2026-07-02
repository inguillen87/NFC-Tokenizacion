import { randomUUID } from "node:crypto";

import { json } from "../../../../lib/http";
import {
  authenticateSdkRequest,
  logSdkUsage,
  type SdkAuthContext,
} from "../../../../lib/sdk-auth";

export function clean(value: unknown) {
  return String(value || "").trim();
}

export function readUid(body: Record<string, unknown>) {
  return clean(body.uidHex || body.uid_hex).toUpperCase();
}

export function readShipmentId(body: Record<string, unknown>) {
  return clean(body.shipmentId || body.shipment_id);
}

export async function authenticateLogisticsRequest(req: Request, endpoint: string, startedAt: number) {
  const auth = await authenticateSdkRequest(req, "sdk:logistics");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint, statusCode: auth.response.status, startedAt, reason: "auth_failed" });
  }
  return auth;
}

export async function logLogisticsUsage(input: {
  req: Request;
  context?: SdkAuthContext | null;
  endpoint: string;
  statusCode: number;
  startedAt: number;
  reason?: string | null;
  meta?: Record<string, unknown>;
}) {
  await logSdkUsage(input);
}

export function rejectBodyTenantMismatch(body: Record<string, unknown>, context: SdkAuthContext) {
  const tenantId = clean(body.tenantId || body.tenant_id);
  const tenantSlug = clean(body.tenantSlug || body.tenant_slug || body.tenant);

  if (tenantId && tenantId !== context.tenantId) {
    return json({ ok: false, reason: "tenant_body_mismatch", trace_id: context.traceId }, 403);
  }
  if (tenantSlug && tenantSlug.toLowerCase() !== context.tenantSlug.toLowerCase()) {
    return json({ ok: false, reason: "tenant_body_mismatch", trace_id: context.traceId }, 403);
  }
  return null;
}

export function logisticsTraceId(context?: SdkAuthContext | null) {
  return context?.traceId || `log_${randomUUID()}`;
}
