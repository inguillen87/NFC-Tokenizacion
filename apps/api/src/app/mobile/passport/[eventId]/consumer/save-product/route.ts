export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { saveTapForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { isClaimableOwnershipResult, matchesOwnershipBatch, matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureConsumerPortalSchema();
  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    tenant_id?: string;
    tenantSlug?: string;
    tenant_slug?: string;
    tenant?: string;
    bid?: string;
    email?: string;
    contact?: string;
  };
  const { eventId } = await params;
  const tapEvent = await getTapEvent(eventId);
  if (!tapEvent) return json({ ok: false, error: "event_not_found" }, 404);
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  if (!matchesOwnershipTenant({
    eventTenantId: tapEvent.tenant_id,
    eventTenantSlug: tapEvent.tenant_slug,
    requestedTenantId: body.tenantId || body.tenant_id,
    requestedTenantSlug: body.tenantSlug || body.tenant_slug,
    requestedTenant: body.tenant,
  })) {
    return json({ ok: false, error: "tenant_mismatch" }, 403);
  }
  if (!matchesOwnershipBatch({ eventBid: tapEvent.bid, requestedBid: body.bid })) return json({ ok: false, error: "tenant_batch_mismatch" }, 403);
  if (!isClaimableOwnershipResult(String(tapEvent.result || ""))) return json({ ok: false, error: "tap_not_claimable" }, 409);
  const savedEvent = await saveTapForConsumer({ consumerId: consumer.id, eventId });
  if (!savedEvent) return json({ ok: false, error: "event_not_found" }, 404);
  return json({ ok: true, saved: true, eventId });
}
