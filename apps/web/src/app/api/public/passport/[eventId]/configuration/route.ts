import { NextResponse } from "next/server";
import { configurationEventId, readPublicTenantConfiguration } from "../../../../../../lib/public-tenant-configuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!configurationEventId(eventId)) return NextResponse.json({ ok: false, error: "invalid_event_id" }, { status: 400, headers: { "cache-control": "private, no-store" } });
  const configuration = await readPublicTenantConfiguration(eventId);
  return NextResponse.json(configuration ? { ok: true, configuration } : { ok: false, error: "tenant_configuration_unavailable" },
    { status: configuration ? 200 : 503, headers: { "cache-control": "private, no-store" } });
}
