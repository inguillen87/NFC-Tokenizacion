export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { saveTapForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { isClaimableOwnershipResult, matchesOwnershipBatch, matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { evaluateTapCommercialRights, readCurrentTapCommercialRights } from "../../../../../../lib/tap-commercial-rights";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:save-product` });
  if (limited) return limited;
  let body: {
    tenantId?: string;
    tenant_id?: string;
    tenantSlug?: string;
    tenant_slug?: string;
    tenant?: string;
    bid?: string;
    email?: string;
    contact?: string;
  };
  try {
    body = await readBoundedJsonBody<typeof body>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const { eventId } = await params;
  const tapEvent = await getTapEvent(eventId);
  if (!tapEvent) return json({ ok: false, error: "event_not_found" }, 404);
  await ensureConsumerPortalSchema();
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
  if (!evaluateTapCommercialRights(tapEvent).allowed || !isClaimableOwnershipResult(String(tapEvent.result || ""))) return json({ ok: false, error: "tap_not_claimable" }, 409);
  const capability = await consumeSunFreshHandoff(req, body as Record<string, unknown>, {
    eventId: String(tapEvent.id), bid: String(tapEvent.bid || ""), uidHex: String(tapEvent.uid_hex || ""), readCounter: tapEvent.sdm_read_ctr,
  }, "consumer_save_product");
  if (!capability.ok) return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  const currentRights = await readCurrentTapCommercialRights(tapEvent.id);
  if (!currentRights.allowed) return json({ ok: false, error: currentRights.reason }, currentRights.reason === "manual_opening_declared" ? 409 : 503);
  const savedEvent = await saveTapForConsumer({ consumerId: consumer.id, eventId });
  if (!savedEvent) return json({ ok: false, error: "event_not_found" }, 404);
  return json({ ok: true, saved: true, eventId });
}
