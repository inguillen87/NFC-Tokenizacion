export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { canUseDemoConsumerForTap, getConsumerFromRequest, getOrCreateDemoConsumer } from "../../../../../../lib/consumer-auth";
import { ensureTenantMembership, saveTapForConsumer } from "../../../../../../lib/consumer-portal-service";
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
    demoConsumer?: boolean;
    consumerMode?: string;
    demoConsumerEmail?: string;
    email?: string;
    contact?: string;
  };
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const consumer =
    (await getConsumerFromRequest(req)) ||
    (canUseDemoConsumerForTap(body, event)
      ? await getOrCreateDemoConsumer(String(body.demoConsumerEmail || body.email || body.contact || "demo.consumer@nexid.local"))
      : null);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  if (!matchesOwnershipTenant({
    eventTenantId: event.tenant_id,
    eventTenantSlug: event.tenant_slug,
    requestedTenantId: body.tenantId || body.tenant_id,
    requestedTenantSlug: body.tenantSlug || body.tenant_slug,
    requestedTenant: body.tenant,
  })) {
    return json({ ok: false, error: "tenant_mismatch" }, 403);
  }
  if (!matchesOwnershipBatch({ eventBid: event.bid, requestedBid: body.bid })) return json({ ok: false, error: "tenant_batch_mismatch" }, 403);
  if (!isClaimableOwnershipResult(String(event.result || ""))) return json({ ok: false, error: "tap_not_claimable" }, 409);
  await saveTapForConsumer({ consumerId: consumer.id, eventId: String(event.id) });
  const membership = await ensureTenantMembership({ consumerId: consumer.id, tenantId: event.tenant_id, tapEventId: String(event.id), source: "tap" });
  return json({ ok: true, membership });
}
