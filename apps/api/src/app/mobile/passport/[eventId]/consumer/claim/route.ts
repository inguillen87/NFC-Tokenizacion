export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../../../lib/consumer-portal-service";
import { matchesOwnershipTenant, matchesOwnershipBatch } from "../../../../../../lib/ownership-policy";
import { readConsumerOwnershipClaimContext, consumeAndAuthorizeConsumerOwnershipClaim } from "../../../../../../lib/consumer-vertical-writer-policy";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:ownership-claim` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024); }
  catch (error) { return json({ ok: false, error: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json" }, error instanceof RequestBodyTooLargeError ? 413 : 400); }
  const contextKeys = ["tenantId", "tenant_id", "tenantSlug", "tenant_slug", "tenant", "bid"];
  if (contextKeys.some(key => Object.prototype.hasOwnProperty.call(body, key) && typeof body[key] !== "string")) {
    return json({ ok: false, error: "invalid_context", fresh_tap_required: false }, 400, { "cache-control": "no-store" });
  }
  const contextString = (key: string) => typeof body[key] === "string" ? body[key] : undefined;
  const { eventId } = await params;
  const precheck = await readConsumerOwnershipClaimContext(eventId, consumer.id);
  if (!precheck.ok) return json({ ok: false, error: precheck.error, reason: precheck.error, fresh_tap_required: false }, precheck.error === "tap_policy_unavailable" ? 503 : 403, { "cache-control": "no-store" });
  const event = precheck.context.event;
  if (!matchesOwnershipTenant({ eventTenantId: event.tenant_id, eventTenantSlug: event.tenant_slug,
    requestedTenantId: contextString("tenantId") || contextString("tenant_id"), requestedTenantSlug: contextString("tenantSlug") || contextString("tenant_slug"), requestedTenant: contextString("tenant") })
    || !matchesOwnershipBatch({ eventBid: event.bid, requestedBid: contextString("bid") })
    || (body.uidHex || body.uid_hex) && String(body.uidHex || body.uid_hex).trim().toUpperCase() !== event.uid_hex.trim().toUpperCase()) return json({ ok: false, error: "tenant_mismatch", fresh_tap_required: false }, 403);
  const authorized = await consumeAndAuthorizeConsumerOwnershipClaim(req, body, precheck.context, "consumer_claim_ownership");
  if (!authorized.ok) return json({ ok: false, error: authorized.error, reason: authorized.error,
    fresh_tap_required: authorized.freshTapRequired, fresh_token_status: "freshTokenStatus" in authorized ? authorized.freshTokenStatus : undefined,
    ...("retryAfterSeconds" in authorized ? { retry_after_seconds: authorized.retryAfterSeconds } : {}) }, authorized.status,
    { "cache-control": "no-store", ...("retryAfterSeconds" in authorized ? { "retry-after": String(authorized.retryAfterSeconds) } : {}) });
  // This route cannot use purchase-proof review as a title authorization.
  if (!authorized.authorization) return json({ ok: false, error: "purchase_receipt_required", fresh_tap_required: true }, 403, { "cache-control": "no-store" });
  let claimed;
  try { claimed = await claimOwnershipForConsumer({ consumerId: consumer.id, eventId, source: "sun_passport", bid: event.bid,
    uidHex: event.uid_hex, authorization: authorized.authorization }); }
  catch { return json({ ok: false, error: "ownership_write_unavailable", fresh_tap_required: true }, 503, { "cache-control": "no-store" }); }
  if (!claimed.ok) return json({ ok: false, error: claimed.error, ownership: claimed.ownership || null,
    operation_committed: "operationCommitted" in claimed && claimed.operationCommitted === true,
    fresh_tap_required: !("operationCommitted" in claimed && claimed.operationCommitted === true) }, claimed.status, { "cache-control": "no-store" });
  return json({ ok: true, eventId, consumerId: consumer.id, ownership: claimed.ownership,
    canonical_event: claimed.canonicalEvent, webhook_outbox: claimed.canonicalEvent.webhookOutbox,
    ownership_scope: "nexid_off_chain_digital_title", chain_transfer_status: "not_executed", nft_transfer_executed: false, on_chain_owner_verified: false });
}
