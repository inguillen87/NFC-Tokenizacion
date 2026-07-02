import { NextResponse } from "next/server";
import { processSealScan } from "../../../../../lib/secure-delivery";
import { sql } from "../../../../../lib/db";
import { ensureSecureDeliverySchema } from "../../../../../lib/secure-delivery-schema";

export async function POST(req: Request) {
  try {
    await ensureSecureDeliverySchema();
    const body = await req.json();
    const { uidHex, ttRaw, tenantId, shipmentId, shipment_id, location, recipientName, verificationMethod } = body;

    if (!uidHex || !tenantId) {
      return NextResponse.json({ error: "uidHex and tenantId are required" }, { status: 400 });
    }

    const result = await processSealScan({
      uidHex,
      tenantId,
      ttRaw: ttRaw || null,
      shipmentId: shipmentId || shipment_id,
      location,
      scannedBy: recipientName,
      context: "VERIFY",
    });

    if (result.shipmentId) {
      await sql/*sql*/`
        INSERT INTO recipient_verifications (tenant_id, shipment_id, recipient_name, verification_method, status, verified_at)
        VALUES (${tenantId}, ${result.shipmentId}, ${recipientName || null}, ${verificationMethod || 'NFC_TAP'}, 'verified', now())
      `;
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
