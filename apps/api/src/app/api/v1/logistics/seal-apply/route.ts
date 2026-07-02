import { NextResponse } from "next/server";
import { processSealScan } from "../../../../../lib/secure-delivery";
import { ensureSecureDeliverySchema } from "../../../../../lib/secure-delivery-schema";

export async function POST(req: Request) {
  try {
    await ensureSecureDeliverySchema();
    const body = await req.json();
    const { uidHex, ttRaw, tenantId, shipmentId, shipment_id, location, scannedBy } = body;

    const resolvedShipmentId = shipmentId || shipment_id;
    if (!uidHex || !tenantId || !resolvedShipmentId) {
      return NextResponse.json({ error: "uidHex, tenantId and shipmentId are required" }, { status: 400 });
    }

    const result = await processSealScan({
      uidHex,
      tenantId,
      ttRaw: ttRaw || null,
      shipmentId: resolvedShipmentId,
      location,
      scannedBy,
      context: "APPLY",
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
