import { json } from "../../../../lib/http";
import { buildLifecycleState, listDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";

export async function GET(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const url = new URL(req.url);
  const target = await resolvePublicCtaTarget({
    bid: url.searchParams.get("bid"),
    uid: url.searchParams.get("uid"),
    event_id: url.searchParams.get("event_id") || url.searchParams.get("eventId"),
  });
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);

  const actions = await listDemoCta(bid, uid);
  const lifecycle = buildLifecycleState(bid, uid, actions);
  const commercialSignals = {
    ownership_claimed: lifecycle.ownership.ownership_status === "claimed",
    warranty_registered: actions.some((entry) => String(entry.action || "") === "register_warranty"),
    tokenization_interest: actions.some((entry) => String(entry.action || "") === "tokenize_request"),
  };
  return json({
    ok: true,
    bid,
    uid,
    actions,
    ...lifecycle,
    commercial_signals: commercialSignals,
    enterprise_story: [
      "digital_product_passport",
      "ownership_and_warranty",
      "provenance_and_lifecycle",
      "blockchain_ready_optional_layer",
    ],
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  });
}
