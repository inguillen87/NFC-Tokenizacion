export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { publishActorAssociationProjection } from "../../../../../../lib/consumer-portal-service";
import { associateConsumerVerticalTap, readConsumerVerticalContext } from "../../../../../../lib/consumer-vertical-writer-policy";
import { matchesOwnershipBatch, matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { ensureConsumerPortalSchema } from "../../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:join-tenant` });
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
  const decision = await readConsumerVerticalContext(eventId, "join");
  if (!decision.ok) return json({ ok: false, error: decision.error }, decision.error === "tap_policy_unavailable" ? 503 : 403);
  const event = decision.context.event;
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
  await ensureConsumerPortalSchema();
  const capability = await consumeSunFreshHandoff(req, body as Record<string, unknown>, {
    eventId: String(event.id), bid: String(event.bid || ""), uidHex: String(event.uid_hex || ""), readCounter: event.sdm_read_ctr,
  }, "consumer_join_tenant");
  if (!capability.ok) return json({ ok: false, error: "fresh_tap_capability_required", fresh_token_status: capability.reason }, 403);
  let association;
  try { association = await associateConsumerVerticalTap({ consumerId: consumer.id, context: decision.context }); }
  catch { return json({ ok: false, error: "tap_policy_unavailable", fresh_tap_required: true }, 503); }
  if (!association) return json({ ok: false, error: "tap_policy_changed", fresh_tap_required: true }, 409);
  if (association.history_inserted) await publishActorAssociationProjection(association.id);
  return json({ ok: true, membership: association.membership });
}
