import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bid = String(body.bid || "").trim();
  const uid = String(body.uid || body.uid_hex || "").trim().toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required" }, 400);

  const auth = requireShareToken(req, bid, uid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason }, 401);

  const saved = await recordDemoCta("claim_ownership", bid, uid, body);
  return json({ ok: true, action: "claim_ownership", id: saved.id, created_at: saved.created_at });
}
