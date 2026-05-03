import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { sql } from "../../../../lib/db";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { requireSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";

const LEDGER_NETWORK_ALLOWED = new Set(["polygon-amoy", "polygon", "ethereum-sepolia", "ethereum-mainnet", "base-sepolia", "base-mainnet"]);

function sanitizeText(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function shouldAutoAnchorPublicTokenization() {
  return String(process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP || "").toLowerCase() === "true"
    || String(process.env.PUBLIC_CTA_AUTO_TOKENIZE || "").toLowerCase() === "true";
}

async function maybeAnchorPublicRequest(requestId: string | undefined, network: string, issuerWallet: string | null) {
  if (!requestId || !shouldAutoAnchorPublicTokenization()) return null;
  return anchorTokenizationRequest({
    requestId,
    network,
    issuerWallet,
    processor: "public_cta_tokenize_request",
  });
}

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
      reason: "fresh_physical_tap_required_for_tokenization",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: freshReason,
    }, 403);
  }

  await ensureTokenizationRequestsSchema();

  const requestedNetworkRaw = sanitizeText(body.ledger_network || "polygon-amoy", 40).toLowerCase();
  const ledgerNetwork = LEDGER_NETWORK_ALLOWED.has(requestedNetworkRaw) ? requestedNetworkRaw : "polygon-amoy";
  const ledger = {
    ledger_status: sanitizeText(body.ledger_status || "simulated", 32),
    ledger_network: ledgerNetwork,
    ledger_ref: sanitizeText(body.ledger_ref, 160) || null,
    asset_ref: sanitizeText(body.asset_ref || `${bid}:${uid}`, 180),
    anchor_hash: sanitizeText(body.anchor_hash, 180) || null,
    issuer_wallet: sanitizeText(body.issuer_wallet, 180) || null,
    last_anchor_at: sanitizeText(body.last_anchor_at, 80) || null,
  };
  const policyMeta = {
    condition_state: sanitizeText(body.condition_state, 80) || null,
    claim_mode: sanitizeText(body.claim_mode, 80) || null,
    tokenization_policy: sanitizeText(body.tokenization_policy, 80) || null,
    marketplace_mode: sanitizeText(body.marketplace_mode, 80) || null,
    requirements: Array.isArray(body.requirements)
      ? body.requirements.map((item) => sanitizeText(item, 120)).filter(Boolean).slice(0, 8)
      : [],
  };

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id
    FROM batches b
    WHERE b.bid = ${bid}
    LIMIT 1
  `;
  const batch = batchRows[0];

  const existingRows = await sql/*sql*/`
    SELECT id, status, requested_at, network, asset_ref, issuer_wallet, anchor_hash, tx_hash, token_id, last_error, next_attempt_at
    FROM tokenization_requests
    WHERE bid = ${bid}
      AND uid_hex = ${uid}
      AND status IN ('pending', 'processing', 'failed', 'anchored')
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  const existingRequest = existingRows[0];
  if (existingRequest) {
    const alreadyAnchored = String(existingRequest.status || "") === "anchored";
    const anchor = alreadyAnchored ? null : await maybeAnchorPublicRequest(String(existingRequest.id || ""), ledger.ledger_network, ledger.issuer_wallet);
    const anchorStatus = anchor && typeof anchor === "object" && "status" in anchor ? String(anchor.status || "") : "";
    return json({
      ok: true,
      action: "tokenize_request",
      deduplicated: true,
      reason: alreadyAnchored ? "existing request already anchored" : anchor?.ok ? "existing request anchored" : anchorStatus === "pending" ? "existing request queued for retry" : "existing request reused",
      tokenization_request: { ...existingRequest, status: anchor?.ok ? "anchored" : anchorStatus || existingRequest.status },
      anchor,
      trace_id: traceId,
      share_token_status: auth.share_token_status,
    });
  }

  const reqRows = await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, bid, uid_hex, status, network, asset_ref, issuer_wallet, anchor_hash, requested_by, next_attempt_at, meta
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
      now(),
      ${JSON.stringify({ trace_id: traceId, share_token_status: auth.share_token_status, fresh_handoff_exp: fresh.payload.exp, ...policyMeta })}::jsonb
    )
    RETURNING id, status, requested_at
  `;
  const tokenizationRequest = reqRows[0];
  const anchor = await maybeAnchorPublicRequest(String(tokenizationRequest?.id || ""), ledger.ledger_network, ledger.issuer_wallet);
  const saved = await recordDemoCta("tokenize_request", bid, uid, { ...body, ...ledger, ...policyMeta, fresh_handoff_exp: fresh.payload.exp, tokenization_requested_at: new Date().toISOString() });
  return json({
    ok: true,
    action: "tokenize_request",
    id: saved.id,
    created_at: saved.created_at,
    ledger,
    tokenization_request: tokenizationRequest || null,
    anchor,
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
  });
}
