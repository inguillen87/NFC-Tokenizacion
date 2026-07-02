import { NextResponse } from "next/server";
import { processSealScan } from "../../../../../lib/secure-delivery";
import { ensureSecureDeliverySchema } from "../../../../../lib/secure-delivery-schema";
import {
  authenticateLogisticsRequest,
  clean,
  logLogisticsUsage,
  readShipmentId,
  readUid,
  rejectBodyTenantMismatch,
} from "../_shared";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const auth = await authenticateLogisticsRequest(req, "logistics.handoff", startedAt);
  if (!auth.ok) return auth.response;

  try {
    await ensureSecureDeliverySchema();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mismatch = rejectBodyTenantMismatch(body, auth.context);
    if (mismatch) {
      await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.handoff", statusCode: 403, startedAt, reason: "tenant_body_mismatch" });
      return mismatch;
    }

    const uidHex = readUid(body);
    if (!uidHex) {
      await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.handoff", statusCode: 400, startedAt, reason: "uid_required" });
      return NextResponse.json({ ok: false, reason: "uidHex_required", trace_id: auth.context.traceId }, { status: 400 });
    }

    const result = await processSealScan({
      uidHex,
      tenantId: auth.context.tenantId,
      ttRaw: clean(body.ttRaw || body.tt_raw) || null,
      shipmentId: readShipmentId(body) || undefined,
      location: clean(body.location),
      scannedBy: clean(body.scannedBy || body.scanned_by || body.operator),
      context: "HANDOFF",
    });

    await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.handoff", statusCode: 200, startedAt, meta: { shipmentId: result.shipmentId, status: result.newStatus } });
    return NextResponse.json({ ok: true, tenant: { slug: auth.context.tenantSlug }, trace_id: auth.context.traceId, data: result });
  } catch (error: any) {
    await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.handoff", statusCode: 400, startedAt, reason: error?.message || "handoff_failed" });
    return NextResponse.json({ ok: false, reason: "handoff_failed", error: error.message, trace_id: auth.context.traceId }, { status: 400 });
  }
}
