import { json } from "../../../../lib/http";
import { buildLifecycleState, listDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";

export async function GET(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const url = new URL(req.url);
  const bid = String(url.searchParams.get("bid") || "").trim();
  const uid = String(url.searchParams.get("uid") || "").trim().toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required", trace_id: traceId }, 400);

  const auth = requireShareToken(req, bid, uid);
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
