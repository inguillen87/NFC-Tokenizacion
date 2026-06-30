import { NextResponse } from "next/server";

import { buildGs1DigitalLinkSunUrl } from "../../../../id/_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; serial: string }> }) {
  const { gtin, serial } = await context.params;
  return NextResponse.redirect(buildGs1DigitalLinkSunUrl(req.url, { gtin, serial }), 307);
}
