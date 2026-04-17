import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bid = String(body.bid || "").trim();
  const uid = String(body.uid || body.uid_hex || "").trim().toUpperCase();
  if (!bid || !uid) return json({ ok: false, reason: "bid and uid required", trace_id: traceId }, 400);

  const auth = requireShareToken(req, bid, uid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);

  const ledger = {
    ledger_status: String(body.ledger_status || "simulated"),
    ledger_network: String(body.ledger_network || "not_selected"),
    asset_ref: String(body.asset_ref || `${bid}:${uid}`),
    anchor_hash: String(body.anchor_hash || "") || null,
    issuer_wallet: String(body.issuer_wallet || "") || null,
    last_anchor_at: String(body.last_anchor_at || "") || null,
  };
  const saved = await recordDemoCta("tokenize_request", bid, uid, { ...body, ...ledger, tokenization_requested_at: new Date().toISOString() });
  return json({ ok: true, action: "tokenize_request", id: saved.id, created_at: saved.created_at, ledger, trace_id: traceId, share_token_status: auth.share_token_status });
}
