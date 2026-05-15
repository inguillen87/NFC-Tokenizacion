import { json } from "../../../../lib/http";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../lib/consumer-portal-service";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { requireSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid, eventId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  const fresh = requireSunFreshHandoff(req, body, { bid, eventId });
  if (!eventId || !fresh.ok) {
    const freshReason = fresh.ok ? "fresh_event_required" : fresh.reason;
    return json({
      ok: false,
      reason: "fresh_physical_tap_required_for_ownership",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: freshReason,
    }, 403);
  }

  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (consumer && eventId) {
    const claim = await claimOwnershipForConsumer({
      consumerId: consumer.id,
      eventId,
      bid,
      uidHex: uid,
      source: "sun_passport",
      trustSnapshot: { trace_id: traceId, share_token_status: auth.share_token_status, fresh_handoff_exp: fresh.payload.exp },
    });
    if (!claim.ok) {
      return json(
        { ok: false, reason: claim.error, trace_id: traceId, share_token_status: auth.share_token_status, ownership: claim.ownership || null },
        claim.status,
      );
    }
    return json({
      ok: true,
      action: "claim_ownership",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
      ownership: claim.ownership,
      ownership_status: claim.ownership?.status || "claimed",
      ownership_mode: "durable",
    });
  }

  return json({
    ok: false,
    reason: "consumer_auth_required",
    action: "claim_ownership",
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
    next_step: "verify_email_or_phone",
    claim_protocol: {
      required: ["fresh_physical_tap", "verified_email_or_phone"],
      optional: ["purchase_receipt", "retailer_pos_token", "wallet_address"],
      unlocks: ["durable_passport_ownership", "wallet_connection", "nft_tokenization_request", "marketplace_listing"],
    },
  }, 401);
}
