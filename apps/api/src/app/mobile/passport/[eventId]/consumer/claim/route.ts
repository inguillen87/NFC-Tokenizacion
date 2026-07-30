export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";

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
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:ownership-claim` });
  if (limited) return limited;
  let body: {
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
  try {
    body = await readBoundedJsonBody<typeof body>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  await ensureConsumerPortalSchema();
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
  const fresh = await consumeSunFreshHandoff(req, body as Record<string, unknown>, {
    eventId: expectedEventId,
    bid: expectedBid,
    uidHex: String(event.uid_hex || ""),
    readCounter: event.sdm_read_ctr,
  }, "consumer_claim_ownership");
  if (!fresh.ok) return freshOwnershipForbidden(fresh.reason);
  const claimed = await claimOwnershipForConsumer({
    consumerId: consumer.id,
    eventId,
    source: "sun_passport",
    bid: body.bid,
    uidHex: body.uidHex || body.uid_hex,
  });
  if (!claimed.ok) return json({
    ok: false,
    error: claimed.error,
    ownership: claimed.ownership || null,
    operation_committed: "operationCommitted" in claimed ? claimed.operationCommitted : false,
  }, claimed.status);
  return json({
    ok: true,
    eventId,
    consumerId: consumer.id,
    ownership: claimed.ownership,
    canonical_event: claimed.canonicalEvent,
    webhook_outbox: claimed.canonicalEvent.webhookOutbox,
    ownership_scope: "nexid_off_chain_digital_title",
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    on_chain_owner_verified: false,
  });
}
