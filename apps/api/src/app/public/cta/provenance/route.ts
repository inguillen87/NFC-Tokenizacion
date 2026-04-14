import { json } from "../../../../lib/http";
import { listDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bid = String(url.searchParams.get("bid") || "").trim();
  const uid = String(url.searchParams.get("uid") || "").trim().toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required" }, 400);

  const auth = requireShareToken(req, bid, uid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

  const actions = await listDemoCta(bid, uid);
  return json({ ok: true, bid, uid, actions });
}
