export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { canUseDemoConsumerForTap, getConsumerFromRequest, getOrCreateDemoConsumer } from "../../../../../../lib/consumer-auth";
import { saveTapForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { isClaimableOwnershipResult, matchesOwnershipBatch, matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureConsumerPortalSchema();
  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    bid?: string;
    demoConsumer?: boolean;
    consumerMode?: string;
    demoConsumerEmail?: string;
    email?: string;
    contact?: string;
  };
  const { eventId } = await params;
  const tapEvent = await getTapEvent(eventId);
  if (!tapEvent) return json({ ok: false, error: "event_not_found" }, 404);
  const consumer =
    (await getConsumerFromRequest(req)) ||
    (canUseDemoConsumerForTap(body, tapEvent)
      ? await getOrCreateDemoConsumer(String(body.demoConsumerEmail || body.email || body.contact || "demo.consumer@nexid.local"))
      : null);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  if (!matchesOwnershipTenant({ eventTenantId: tapEvent.tenant_id, requestedTenantId: body.tenantId })) {
    return json({ ok: false, error: "tenant_mismatch" }, 403);
  }
  if (!matchesOwnershipBatch({ eventBid: tapEvent.bid, requestedBid: body.bid })) return json({ ok: false, error: "tenant_batch_mismatch" }, 403);
  if (!isClaimableOwnershipResult(String(tapEvent.result || ""))) return json({ ok: false, error: "tap_not_claimable" }, 409);
  const savedEvent = await saveTapForConsumer({ consumerId: consumer.id, eventId });
  if (!savedEvent) return json({ ok: false, error: "event_not_found" }, 404);
  return json({ ok: true, saved: true, eventId });
}
