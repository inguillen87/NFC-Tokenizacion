import { json } from "../../../../lib/http";
import { listDemoCta } from "../../../../lib/demo-cta";
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
  return json({ ok: true, bid, uid, actions, trace_id: traceId, share_token_status: auth.share_token_status });
}
