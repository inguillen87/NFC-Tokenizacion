import { NextResponse } from "next/server";
import { processSealScan } from "../../../../../lib/secure-delivery";
import { sql } from "../../../../../lib/db";
import {
  recipientVerificationStatusForSealStatus,
  shouldCreateDeliveryClaimForStatus,
} from "../../../../../lib/secure-delivery-policy";
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
  const auth = await authenticateLogisticsRequest(req, "logistics.recipient_verify", startedAt);
  if (!auth.ok) return auth.response;

  try {
    await ensureSecureDeliverySchema();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mismatch = rejectBodyTenantMismatch(body, auth.context);
    if (mismatch) {
      await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.recipient_verify", statusCode: 403, startedAt, reason: "tenant_body_mismatch" });
      return mismatch;
    }

    const uidHex = readUid(body);
    if (!uidHex) {
      await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.recipient_verify", statusCode: 400, startedAt, reason: "uid_required" });
      return NextResponse.json({ ok: false, reason: "uidHex_required", trace_id: auth.context.traceId }, { status: 400 });
    }

    const recipientName = clean(body.recipientName || body.recipient_name);
    const verificationMethod = clean(body.verificationMethod || body.verification_method) || "NFC_TAP";
    const result = await processSealScan({
      uidHex,
      tenantId: auth.context.tenantId,
      ttRaw: clean(body.ttRaw || body.tt_raw) || null,
      shipmentId: readShipmentId(body) || undefined,
      location: clean(body.location),
      scannedBy: recipientName,
      context: "VERIFY",
    });

    if (result.shipmentId) {
      const verificationStatus = recipientVerificationStatusForSealStatus(result.newStatus);
      await sql/*sql*/`
        INSERT INTO recipient_verifications (tenant_id, shipment_id, recipient_name, verification_method, status, verified_at)
        VALUES (${auth.context.tenantId}, ${result.shipmentId}, ${recipientName || null}, ${verificationMethod}, ${verificationStatus}, now())
      `;

      if (shouldCreateDeliveryClaimForStatus(result.newStatus)) {
        const issueType = result.newStatus === "DELIVERED_OPENED" ? "tamper_reported" : "seal_review_required";
        await sql/*sql*/`
          INSERT INTO delivery_claims (tenant_id, shipment_id, issue_type, description, status)
          SELECT
            ${auth.context.tenantId},
            ${result.shipmentId},
            ${issueType},
            ${`Recipient verification moved shipment to ${result.newStatus}; tamper state ${result.tamperState}.`},
            'open'
          WHERE NOT EXISTS (
            SELECT 1
            FROM delivery_claims
            WHERE shipment_id = ${result.shipmentId}
              AND issue_type = ${issueType}
              AND status = 'open'
          )
        `;
      }
    }

    await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.recipient_verify", statusCode: 200, startedAt, meta: { shipmentId: result.shipmentId, status: result.newStatus } });
    return NextResponse.json({ ok: true, tenant: { slug: auth.context.tenantSlug }, trace_id: auth.context.traceId, data: result });
  } catch (error: any) {
    await logLogisticsUsage({ req, context: auth.context, endpoint: "logistics.recipient_verify", statusCode: 400, startedAt, reason: error?.message || "recipient_verify_failed" });
    return NextResponse.json({ ok: false, reason: "recipient_verify_failed", error: error.message, trace_id: auth.context.traceId }, { status: 400 });
  }
}
