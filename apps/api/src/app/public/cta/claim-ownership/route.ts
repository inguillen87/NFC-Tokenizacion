import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../lib/consumer-portal-service";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid, eventId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);

  const consumer = await getConsumerFromRequest(req);
  if (consumer && eventId) {
    const claim = await claimOwnershipForConsumer({
      consumerId: consumer.id,
      eventId,
      bid,
      uidHex: uid,
      source: "sun_passport",
      trustSnapshot: { trace_id: traceId, share_token_status: auth.share_token_status },
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
      ownership: claim.ownership,
      ownership_status: claim.ownership?.status || "claimed",
      ownership_mode: "durable",
    });
  }

  const ownership = {
    ownership_status: "claimed",
    claim_source: String(body.claim_source || body.source || "public_cta"),
    issuer: String(body.issuer || "nexID"),
    owner_reference: String(body.owner_reference || body.email || body.phone || "consumer"),
    claim_evidence: String(body.claim_evidence || body.scan_context || "sun_validation"),
    transfer_capability: "state-only",
    revocation_capability: "issuer-review",
  };
  const saved = await recordDemoCta("claim_ownership", bid, uid, { ...body, ...ownership, claimed_at: new Date().toISOString() });
  return json({ ok: true, action: "claim_ownership", id: saved.id, created_at: saved.created_at, ownership, ownership_mode: "demo", trace_id: traceId, share_token_status: auth.share_token_status });
}
