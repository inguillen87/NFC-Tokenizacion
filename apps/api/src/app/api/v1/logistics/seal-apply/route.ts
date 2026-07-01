import { NextResponse } from "next/server";
import { processSealScan } from "../../../../../lib/secure-delivery";
import { ensureSecureDeliverySchema } from "../../../../../lib/secure-delivery-schema";

export async function POST(req: Request) {
  try {
    await ensureSecureDeliverySchema();
    const body = await req.json();
    const { uidHex, ttRaw, tenantId, location, scannedBy } = body;

    if (!uidHex || !tenantId) {
      return NextResponse.json({ error: "uidHex and tenantId are required" }, { status: 400 });
    }

    const result = await processSealScan({
      uidHex,
      tenantId,
      ttRaw: ttRaw || null,
      location,
      scannedBy,
      context: "APPLY",
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
