import { NextResponse } from "next/server";

import { buildGs1DigitalLinkSunUrl } from "../../../../_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; lot: string }> }) {
  const { gtin, lot } = await context.params;
  return NextResponse.redirect(buildGs1DigitalLinkSunUrl(req.url, { gtin, lot }), 307);
}
