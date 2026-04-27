export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { ensureTenantMembership } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { tenantId?: string };
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  if (!matchesOwnershipTenant({ eventTenantId: event.tenant_id, requestedTenantId: body.tenantId })) {
    return json({ ok: false, error: "tenant_mismatch" }, 403);
  }
  const membership = await ensureTenantMembership({ consumerId: consumer.id, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
  return json({ ok: true, membership });
}
