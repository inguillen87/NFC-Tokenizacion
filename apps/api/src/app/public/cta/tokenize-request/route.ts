import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { sql } from "../../../../lib/db";

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
    ledger_network: String(body.ledger_network || "polygon-amoy"),
    ledger_ref: String(body.ledger_ref || "") || null,
    asset_ref: String(body.asset_ref || `${bid}:${uid}`),
    anchor_hash: String(body.anchor_hash || "") || null,
    issuer_wallet: String(body.issuer_wallet || "") || null,
    last_anchor_at: String(body.last_anchor_at || "") || null,
  };

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${bid}
    LIMIT 1
  `;
  const batch = batchRows[0];
  const reqRows = await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, bid, uid_hex, status, network, asset_ref, issuer_wallet, anchor_hash, requested_by, meta
    ) VALUES (
      ${batch?.tenant_id || null},
      ${batch?.id || null},
      ${bid},
      ${uid},
      'pending',
      ${ledger.ledger_network},
      ${ledger.asset_ref},
      ${ledger.issuer_wallet},
      ${ledger.anchor_hash},
      'public_cta',
      ${JSON.stringify({ trace_id: traceId, share_token_status: auth.share_token_status })}::jsonb
    )
    RETURNING id, status, requested_at
  `;
  const tokenizationRequest = reqRows[0];
  const saved = await recordDemoCta("tokenize_request", bid, uid, { ...body, ...ledger, tokenization_requested_at: new Date().toISOString() });
  return json({
    ok: true,
    action: "tokenize_request",
    id: saved.id,
    created_at: saved.created_at,
    ledger,
    tokenization_request: tokenizationRequest || null,
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  });
}
