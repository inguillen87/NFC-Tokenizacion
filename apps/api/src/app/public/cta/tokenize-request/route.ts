import { json } from "../../../../lib/http";
import { isAddress } from "ethers";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { sql } from "../../../../lib/db";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";
import { anchorTokenizationRequest } from "../../../../lib/tokenization-engine";
import { resolvePublicCtaTarget, type PublicCtaTokenizationPolicy } from "../../../../lib/public-cta-target";
import { requireSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { normalizeTokenizationStatus } from "../../../../lib/tokenization-status";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

const LEDGER_NETWORK_ALLOWED = new Set(["polygon-amoy", "polygon", "ethereum-sepolia", "ethereum-mainnet", "base-sepolia", "base-mainnet"]);
const PRIVILEGED_PUBLIC_POLICIES = new Set<PublicCtaTokenizationPolicy>(["lot_anchor", "issuer_batch_anchor"]);

type AnchorResult = {
  ok?: boolean;
  simulated?: boolean;
  status?: string | null;
  simulation_ref?: string | null;
  tx_hash?: string | null;
  token_id?: string | null;
  reason?: string | null;
  next_attempt_at?: string | null;
};

type TokenizationRequestRow = {
  id?: string;
  status?: string | null;
  requested_at?: string | Date | null;
  network?: string | null;
  asset_ref?: string | null;
  issuer_wallet?: string | null;
  anchor_hash?: string | null;
  tx_hash?: string | null;
  token_id?: string | null;
  last_error?: string | null;
  next_attempt_at?: string | Date | null;
  attempt_count?: number | string | null;
};

function sanitizeText(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function shouldAutoAnchorPublicTokenization() {
  return String(process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP || "").toLowerCase() === "true"
    || String(process.env.PUBLIC_CTA_AUTO_TOKENIZE || "").toLowerCase() === "true";
}

async function maybeAnchorPublicRequest(requestId: string | undefined, tenantId: string, network: string, issuerWallet: string | null) {
  if (!requestId || !shouldAutoAnchorPublicTokenization()) return null;
  return anchorTokenizationRequest({
    requestId,
    tenantId,
    network,
    issuerWallet,
    processor: "public_cta_tokenize_request",
  });
}

async function loadTokenizationRequest(requestId: string | undefined, tenantId: string) {
  if (!requestId) return null;
  const rows = await sql/*sql*/`
    SELECT id, status, requested_at, network, asset_ref, issuer_wallet, anchor_hash, tx_hash, token_id, last_error, next_attempt_at, attempt_count
    FROM tokenization_requests
    WHERE id = ${requestId}
      AND tenant_id = ${tenantId}::uuid
    LIMIT 1
  `;
  return (rows[0] || null) as TokenizationRequestRow | null;
}

function normalizedStatus(request: TokenizationRequestRow | null, anchor: AnchorResult | null) {
  const status = normalizeTokenizationStatus(anchor?.status || request?.status || "");
  if (status === "simulated" || anchor?.simulated === true) return "simulated";
  if (status === "anchored" && (request?.tx_hash || request?.token_id || anchor?.tx_hash || anchor?.token_id)) return "anchored";
  return status === "none" ? "pending" : status;
}

function tokenizationOutcome(request: TokenizationRequestRow | null, anchor: AnchorResult | null) {
  const status = normalizedStatus(request, anchor);
  const txHash = anchor?.tx_hash || request?.tx_hash || null;
  const tokenId = anchor?.token_id || request?.token_id || null;
  const error = anchor?.reason || request?.last_error || null;
  const nextAttemptAt = anchor?.next_attempt_at || request?.next_attempt_at || null;
  const mintOk = status === "anchored" && Boolean(txHash || tokenId || anchor?.ok);

  if (status === "anchored") {
    return {
      ok: true,
      mint_ok: mintOk,
      tokenization_status: status,
      tokenization_error: null,
      tx_hash: txHash,
      token_id: tokenId,
      next_attempt_at: null,
      explainer: "Producto anclado en Polygon Amoy con UID hasheado y salt privado.",
    };
  }

  if (status === "simulated") {
    return {
      ok: true,
      mint_ok: false,
      tokenization_status: "simulated",
      tokenization_error: null,
      tx_hash: null,
      token_id: null,
      simulation_ref: anchor?.simulation_ref || null,
      next_attempt_at: null,
      explainer: "Simulacion interna completada. No existe transaccion, token ni prueba en Polygon.",
    };
  }

  if (status === "blocked") {
    return {
      ok: true,
      mint_ok: false,
      tokenization_status: "blocked",
      tokenization_error: error || "tokenization_disabled",
      tx_hash: null,
      token_id: null,
      next_attempt_at: null,
      explainer: "Solicitud conservada, pero el runtime no autoriza simulacion ni mint on-chain.",
    };
  }

  if (status === "failed") {
    return {
      ok: true,
      mint_ok: false,
      tokenization_status: "pending_retry",
      tokenization_error: error || "polygon_mint_failed",
      tx_hash: txHash,
      token_id: tokenId,
      next_attempt_at: nextAttemptAt,
      explainer: "Solicitud guardada. El mint no se completo y quedo en reintento operativo sin exponer el UID crudo.",
    };
  }

  return {
    ok: true,
    mint_ok: false,
    tokenization_status: status,
    tokenization_error: error,
    tx_hash: txHash,
    token_id: tokenId,
    next_attempt_at: nextAttemptAt,
    explainer: "Solicitud guardada y en cola. El minter puede reintentar sin exponer el UID crudo.",
  };
}

function tokenizationCanRunWithoutOwner(policy: PublicCtaTokenizationPolicy) {
  return PRIVILEGED_PUBLIC_POLICIES.has(policy);
}

function normalizePolicy(value: unknown) {
  return sanitizeText(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
}

function requestedPrivilegedPolicy(body: Record<string, unknown>) {
  const direct = normalizePolicy(body.tokenization_policy || body.tokenizationPolicy);
  if (direct === "lot_anchor" || direct === "issuer_batch_anchor") return direct;
  if (body.lot_anchor === true || body.lotAnchor === true) return "lot_anchor";
  if (body.issuer_batch_anchor === true || body.issuerBatchAnchor === true) return "issuer_batch_anchor";
  return null;
}

function verifiedConsumerWallet(consumer: Record<string, unknown> | null) {
  const wallet = sanitizeText(consumer?.wallet_address, 180);
  if (!wallet || !consumer?.wallet_verified_at || consumer?.wallet_control_verified !== true || !isAddress(wallet)) return null;
  return wallet;
}

function configuredRecipient(value: unknown) {
  const wallet = sanitizeText(value, 180);
  if (!wallet) return { ok: true as const, wallet: null };
  if (!isAddress(wallet)) return { ok: false as const, reason: "invalid_configured_tokenization_recipient" };
  return { ok: true as const, wallet };
}

function callerRecipient(body: Record<string, unknown>) {
  return sanitizeText(
    body.issuer_wallet
      || body.issuerWallet
      || body.recipient_wallet
      || body.recipientWallet,
    180,
  );
}

function withoutCallerAuthorizationFields(body: Record<string, unknown>) {
  const sanitized = { ...body };
  for (const field of [
    "tokenization_policy",
    "tokenizationPolicy",
    "lot_anchor",
    "lotAnchor",
    "issuer_batch_anchor",
    "issuerBatchAnchor",
    "issuer_wallet",
    "issuerWallet",
    "recipient_wallet",
    "recipientWallet",
  ]) {
    delete sanitized[field];
  }
  return sanitized;
}

async function hasClaimedOwnership(input: {
  consumerId: string;
  tenantId: string;
  batchId: string;
  uid: string;
  eventId: string;
}) {
  await ensureConsumerPortalSchema();
  const rows = await sql/*sql*/`
    SELECT o.id
    FROM consumer_product_ownerships o
    WHERE o.consumer_id = ${input.consumerId}
      AND o.status = 'claimed'
      AND o.tenant_id = ${input.tenantId}
      AND o.batch_id = ${input.batchId}
      AND o.uid_hex = ${input.uid}
      AND o.event_id::text = ${input.eventId}
    ORDER BY o.claimed_at DESC
    LIMIT 1
  `;
  return Boolean(rows[0]?.id);
}

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, target.status);
  const { bid, uid, eventId, batchId, tenantId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  const fresh = requireSunFreshHandoff(req, body, { bid, eventId, uid: target.shareUid });
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
  if (!batchId || !tenantId) {
    return json({
      ok: false,
      reason: "event_identity_incomplete",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
    }, 409);
  }

  const serverPolicy = target.tokenizationPolicy;
  const requestedBypass = requestedPrivilegedPolicy(body);
  if (requestedBypass && requestedBypass !== serverPolicy) {
    return json({
      ok: false,
      reason: "caller_tokenization_policy_not_authorized",
      action: "tokenize_request",
      trace_id: traceId,
      requested_policy: requestedBypass,
      effective_policy: serverPolicy,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
    }, 403);
  }
  if (serverPolicy === "disabled") {
    return json({
      ok: false,
      reason: "tokenization_disabled_by_tenant_policy",
      action: "tokenize_request",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
    }, 403);
  }

  let consumer: Record<string, unknown> | null = null;
  if (!tokenizationCanRunWithoutOwner(serverPolicy)) {
    consumer = await getConsumerFromRequest(req) as Record<string, unknown> | null;
    if (!consumer) {
      return json({
        ok: false,
        reason: "consumer_auth_required_for_tokenization",
        action: "tokenize_request",
        trace_id: traceId,
        share_token_status: auth.share_token_status,
        fresh_token_status: "accepted",
        next_step: "claim_ownership_first",
      }, 401);
    }
    const ownerOk = await hasClaimedOwnership({
      consumerId: String(consumer.id || ""),
      tenantId,
      batchId,
      uid,
      eventId,
    });
    if (!ownerOk) {
      return json({
        ok: false,
        reason: "ownership_claim_required_for_tokenization",
        action: "tokenize_request",
        trace_id: traceId,
        share_token_status: auth.share_token_status,
        fresh_token_status: "accepted",
        next_step: "claim_ownership_first",
      }, 409);
    }
  }

  const tenantRecipient = configuredRecipient(target.configuredRecipient);
  if (!tenantRecipient.ok) {
    return json({ ok: false, reason: tenantRecipient.reason, trace_id: traceId }, 503);
  }
  const environmentRecipient = tenantRecipient.wallet
    ? { ok: true as const, wallet: null }
    : configuredRecipient(process.env.POLYGON_DEFAULT_RECIPIENT);
  if (!environmentRecipient.ok) {
    return json({ ok: false, reason: environmentRecipient.reason, trace_id: traceId }, 503);
  }
  const consumerRecipient = verifiedConsumerWallet(consumer);
  const trustedRecipient = consumerRecipient || tenantRecipient.wallet || environmentRecipient.wallet;
  const recipientSource = consumerRecipient
    ? "verified_consumer_wallet"
    : tenantRecipient.wallet
      ? "tenant_or_batch_config"
      : environmentRecipient.wallet
        ? "server_default"
        : null;
  const suppliedRecipient = callerRecipient(body);
  if (suppliedRecipient && (!trustedRecipient || suppliedRecipient.toLowerCase() !== trustedRecipient.toLowerCase())) {
    return json({
      ok: false,
      reason: "caller_tokenization_recipient_not_authorized",
      action: "tokenize_request",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
    }, 403);
  }
  if (!trustedRecipient) {
    return json({
      ok: false,
      reason: tokenizationCanRunWithoutOwner(serverPolicy)
        ? "configured_tokenization_recipient_required"
        : "validated_tokenization_recipient_required",
      action: "tokenize_request",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
      next_step: tokenizationCanRunWithoutOwner(serverPolicy) ? "configure_recipient_wallet" : "connect_verified_wallet",
    }, tokenizationCanRunWithoutOwner(serverPolicy) ? 503 : 409);
  }

  const requestedNetworkRaw = sanitizeText(body.ledger_network || "polygon-amoy", 40).toLowerCase();
  const ledgerNetwork = LEDGER_NETWORK_ALLOWED.has(requestedNetworkRaw) ? requestedNetworkRaw : "polygon-amoy";
  const ledger = {
    ledger_status: "pending",
    ledger_network: ledgerNetwork,
    ledger_ref: sanitizeText(body.ledger_ref, 160) || null,
    asset_ref: sanitizeText(body.asset_ref || `${bid}:${uid}`, 180),
    anchor_hash: sanitizeText(body.anchor_hash, 180) || null,
    issuer_wallet: trustedRecipient,
    last_anchor_at: sanitizeText(body.last_anchor_at, 80) || null,
  };
  const policyMeta = {
    condition_state: sanitizeText(body.condition_state, 80) || null,
    claim_mode: sanitizeText(body.claim_mode, 80) || null,
    tokenization_policy: serverPolicy,
    tokenization_policy_source: target.tokenizationPolicySource,
    recipient_source: recipientSource,
    marketplace_mode: sanitizeText(body.marketplace_mode, 80) || null,
    requirements: Array.isArray(body.requirements)
      ? body.requirements.map((item) => sanitizeText(item, 120)).filter(Boolean).slice(0, 8)
      : [],
  };

  await ensureTokenizationRequestsSchema();

  const existingRows = await sql/*sql*/`
    SELECT id, status, requested_at, network, asset_ref, issuer_wallet, anchor_hash, tx_hash, token_id, last_error, next_attempt_at
    FROM tokenization_requests
    WHERE tenant_id = ${tenantId}::uuid
      AND batch_id = ${batchId}::uuid
      AND bid = ${bid}
      AND uid_hex = ${uid}
      AND status IN ('pending', 'processing', 'failed', 'anchored', 'simulated', 'blocked')
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  const existingRequest = existingRows[0];
  if (existingRequest) {
    const alreadyAnchored = String(existingRequest.status || "") === "anchored";
    const anchor = alreadyAnchored
      ? null
      : ((await maybeAnchorPublicRequest(String(existingRequest.id || ""), tenantId, ledger.ledger_network, ledger.issuer_wallet)) as AnchorResult | null);
    const latestRequest = await loadTokenizationRequest(String(existingRequest.id || ""), tenantId);
    const outcome = tokenizationOutcome(latestRequest || existingRequest, anchor);
    return json({
      action: "tokenize_request",
      deduplicated: true,
      reason: alreadyAnchored
        ? "existing request already anchored"
        : outcome.tokenization_status === "anchored"
          ? "existing request anchored"
          : outcome.tokenization_status === "simulated"
            ? "existing request simulated without blockchain"
            : outcome.tokenization_status === "blocked"
              ? "existing request blocked by runtime policy"
          : outcome.tokenization_status === "failed"
            ? "existing request failed"
            : "existing request queued for retry",
      tokenization_request: latestRequest || existingRequest,
      anchor,
      ...outcome,
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
      tokenization_policy: serverPolicy,
      tokenization_policy_source: target.tokenizationPolicySource,
    }, outcome.ok ? 200 : 502);
  }

  const reqRows = await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, bid, uid_hex, status, network, asset_ref, issuer_wallet, anchor_hash, requested_by, next_attempt_at, meta
    ) VALUES (
      ${tenantId},
      ${batchId},
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
  const anchor = (await maybeAnchorPublicRequest(String(tokenizationRequest?.id || ""), tenantId, ledger.ledger_network, ledger.issuer_wallet)) as AnchorResult | null;
  const latestRequest = await loadTokenizationRequest(String(tokenizationRequest?.id || ""), tenantId);
  const outcome = tokenizationOutcome(latestRequest || tokenizationRequest, anchor);
  const saved = await recordDemoCta("tokenize_request", bid, uid, {
    ...withoutCallerAuthorizationFields(body),
    ...ledger,
    ...policyMeta,
    fresh_handoff_exp: fresh.payload.exp,
    tokenization_requested_at: new Date().toISOString(),
  });
  return json({
    action: "tokenize_request",
    id: saved.id,
    created_at: saved.created_at,
    ledger,
    tokenization_request: latestRequest || tokenizationRequest || null,
    anchor,
    ...outcome,
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
    tokenization_policy: serverPolicy,
    tokenization_policy_source: target.tokenizationPolicySource,
  }, outcome.ok ? 201 : 502);
}
