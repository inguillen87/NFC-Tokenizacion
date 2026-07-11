export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { requireSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";

const FRESH_OWNERSHIP_REQUIRED = "fresh_physical_tap_required_for_ownership";

function freshOwnershipForbidden(freshTokenStatus: string) {
  return json({
    ok: false,
    error: FRESH_OWNERSHIP_REQUIRED,
    reason: FRESH_OWNERSHIP_REQUIRED,
    fresh_token_status: freshTokenStatus,
  }, 403);
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureConsumerPortalSchema();
  const body = (await req.json().catch(() => ({}))) as {
    bid?: string;
    tenantId?: string;
    tenant_id?: string;
    tenantSlug?: string;
    tenant_slug?: string;
    tenant?: string;
    uidHex?: string;
    uid_hex?: string;
    email?: string;
    contact?: string;
  };
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const consumer = await getConsumerFromRequest(req);
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
  const expectedEventId = String(event.id || eventId).trim();
  const expectedBid = String(body.bid || event.bid || "").trim();
  if (!expectedBid) return freshOwnershipForbidden("fresh_token_bid_missing");
  const fresh = requireSunFreshHandoff(req, body as Record<string, unknown>, { eventId: expectedEventId, bid: expectedBid });
  if (!fresh.ok) return freshOwnershipForbidden(fresh.reason);
  const claimed = await claimOwnershipForConsumer({
    consumerId: consumer.id,
    eventId,
    source: "sun_passport",
    bid: body.bid,
    uidHex: body.uidHex || body.uid_hex,
  });
  if (!claimed.ok) return json({ ok: false, error: claimed.error, ownership: claimed.ownership || null }, claimed.status);
  return json({ ok: true, eventId, consumerId: consumer.id, ownership: claimed.ownership });
}
