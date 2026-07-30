import { json } from "../../../../lib/http";
import { isAddress } from "ethers";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { sql } from "../../../../lib/db";
import {
  classifyTokenizationExecutionClass,
  ensureTokenizationCommercialScopeSchema,
  isTokenizationCommercialScopeSchemaError,
  TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED,
} from "../../../../lib/tokenization-schema";
import { anchorTokenizationRequest, resolveTokenizationRuntimeMode } from "../../../../lib/tokenization-engine";
import { recordTokenizationCanonicalEvent, type TokenizationEventRecord } from "../../../../lib/tokenization-event-service";
import { resolvePublicCtaTarget, type PublicCtaTokenizationPolicy } from "../../../../lib/public-cta-target";
import { consumeSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { normalizeTokenizationStatus } from "../../../../lib/tokenization-status";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

const MAX_TOKENIZATION_BODY_BYTES = 32 * 1024;

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
  canonical_event_confirmed?: boolean;
  operation_committed?: boolean;
  commercial_disposition?: string | null;
  commercially_eligible?: boolean;
};

type TokenizationRequestRow = {
  id?: string;
  tag_id?: string | null;
  source_event_id?: number | string | null;
  source_event_created_at?: string | Date | null;
  execution_class?: string | null;
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
    SELECT id, tag_id, source_event_id, source_event_created_at, execution_class,
           status, requested_at, network, asset_ref, issuer_wallet, anchor_hash, tx_hash, token_id, last_error, next_attempt_at, attempt_count
    FROM tokenization_requests
    WHERE id = ${requestId}
      AND tenant_id = ${tenantId}::uuid
    LIMIT 1
  `;
  return (rows[0] || null) as TokenizationRequestRow | null;
}

async function ensureCanonicalRequestedEvent(request: TokenizationEventRecord) {
  return recordTokenizationCanonicalEvent({
    request,
    state: "requested",
    runtimeMode: resolveTokenizationRuntimeMode(),
    processor: "public_cta_tokenize_request",
  });
}

function normalizedStatus(request: TokenizationRequestRow | null, anchor: AnchorResult | null) {
  const rawStatus = String(anchor?.status || request?.status || "").trim().toLowerCase();
  if (rawStatus === "reconciling") return "reconciling";
  const status = normalizeTokenizationStatus(anchor?.status || request?.status || "");
  if (status === "simulated" || anchor?.simulated === true) return "simulated";
  if (status === "anchored" && (request?.tx_hash || request?.token_id || anchor?.tx_hash || anchor?.token_id)) return "anchored";
  return status === "none" ? "pending" : status;
}

const PUBLIC_TOKENIZATION_ERROR_REASONS = new Set([
  "tokenization_disabled",
  "tokenization_execution_busy",
  "tokenization_execution_lease_replay",
  "tokenization_execution_reconciliation_required",
  "tokenization_execution_governance_migration_required",
  "tokenization_execution_governance_unavailable",
  "tokenization_execution_unavailable",
  "tokenization_runtime_execution_class_mismatch",
  "tokenization_request_network_class_mismatch",
  "tokenization_request_recipient_mismatch",
  "tokenization_anchor_evidence_not_verified",
  "supplier_pack_purpose_unclassified",
  "supplier_trial_integration_non_sellable",
  "supplier_production_acceptance_v2_required",
]);

function publicTokenizationErrorReason(value: unknown) {
  const reason = String(value || "").trim();
  if (!reason) return null;
  return PUBLIC_TOKENIZATION_ERROR_REASONS.has(reason)
    ? reason
    : "tokenization_execution_unavailable";
}

function publicTokenizationRequest(request: TokenizationRequestRow | null | undefined) {
  if (!request) return null;
  return {
    id: request.id || null,
    status: normalizeTokenizationStatus(request.status),
    requested_at: request.requested_at || null,
    network: request.network || null,
    tx_hash: request.tx_hash || null,
    token_id: request.token_id || null,
    anchor_hash: request.anchor_hash || null,
    next_attempt_at: request.next_attempt_at || null,
    attempt_count: request.attempt_count ?? 0,
    execution_class: request.execution_class || null,
  };
}

function tokenizationOutcome(request: TokenizationRequestRow | null, anchor: AnchorResult | null) {
  const status = normalizedStatus(request, anchor);
  const txHash = anchor?.tx_hash || request?.tx_hash || null;
  const tokenId = anchor?.token_id || request?.token_id || null;
  const error = publicTokenizationErrorReason(anchor?.reason || request?.last_error);
  const nextAttemptAt = anchor?.next_attempt_at || request?.next_attempt_at || null;
  const mintOk = status === "anchored" && Boolean(txHash || tokenId || anchor?.ok);
  const commercialDisposition = sanitizeText(anchor?.commercial_disposition, 80) || null;
  const commerciallyEligible = commercialDisposition !== null
    && commercialDisposition.toUpperCase() === "COMMERCIAL_RELEASE";

  if (status === "anchored") {
    return {
      ok: true,
      mint_ok: mintOk,
      tokenization_status: status,
      tokenization_error: null,
      tx_hash: txHash,
      token_id: tokenId,
      commercial_disposition: commercialDisposition,
      commercially_eligible: commerciallyEligible,
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

  if (status === "reconciling") {
    return {
      ok: true,
      mint_ok: false,
      tokenization_status: "reconciling",
      tokenization_error: error || "external_result_requires_reconciliation",
      tx_hash: null,
      token_id: null,
      next_attempt_at: null,
      safe_to_retry: false,
      explainer: "La solicitud esta en reconciliacion. No se enviara otra transaccion hasta confirmar el resultado externo.",
    };
  }

  if (status === "failed") {
    return {
      ok: true,
      mint_ok: false,
      tokenization_status: "failed",
      tokenization_error: error || "polygon_mint_failed",
      tx_hash: txHash,
      token_id: tokenId,
      next_attempt_at: nextAttemptAt,
      safe_to_retry: false,
      explainer: "No hay prueba on-chain confirmada. La solicitud queda para revision operativa y no autoriza un nuevo envio automatico.",
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
    safe_to_retry: false,
    explainer: "Solicitud guardada. No se informa transaccion ni token hasta contar con evidencia externa confirmada.",
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
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "public:tokenization-capability",
  });
  if (rateLimited) return rateLimited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_TOKENIZATION_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: traceId }, tooLarge ? 413 : 400);
  }
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, target.status);
  const { bid, uid, eventId, batchId, tenantId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  if (!eventId) {
    return json({
      ok: false,
      reason: "fresh_physical_tap_required_for_tokenization",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "fresh_event_required",
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

  try {
    await ensureTokenizationCommercialScopeSchema();
  } catch (error) {
    if (isTokenizationCommercialScopeSchemaError(error)) {
      return json({ ok: false, reason: TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED, trace_id: traceId }, 503, {
        "cache-control": "no-store",
        "retry-after": "2",
      });
    }
    throw error;
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
  const consumerRecipient = verifiedConsumerWallet(consumer);
  const trustedRecipient = consumerRecipient || tenantRecipient.wallet;
  const recipientSource = consumerRecipient
    ? "verified_consumer_wallet"
    : tenantRecipient.wallet
      ? "tenant_or_batch_config"
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

  const fresh = await consumeSunFreshHandoff(
    req,
    body,
    { bid, eventId, uid: target.shareUid },
    "public_tokenize_request",
  );
  if (!fresh.ok) {
    const freshReason = fresh.reason;
    return json({
      ok: false,
      reason: "fresh_physical_tap_required_for_tokenization",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: freshReason,
    }, 403);
  }

  const requestedNetworkHint = sanitizeText(body.ledger_network, 40).toLowerCase();
  if (requestedNetworkHint && requestedNetworkHint !== "polygon-amoy") {
    return json({
      ok: false,
      reason: "caller_tokenization_network_not_authorized",
      trace_id: traceId,
    }, 403, { "cache-control": "no-store" });
  }
  const runtimeMode = resolveTokenizationRuntimeMode();
  const ledgerNetwork = runtimeMode === "simulated" ? "simulation" : "polygon-amoy";
  const ledger = {
    ledger_status: "pending",
    ledger_network: ledgerNetwork,
    ledger_ref: null,
    asset_ref: null,
    anchor_hash: null,
    issuer_wallet: trustedRecipient,
    last_anchor_at: null,
  };
  const executionClass = classifyTokenizationExecutionClass(ledger.ledger_network, {
    simulated: runtimeMode === "simulated",
  });
  if (!executionClass) {
    return json({ ok: false, reason: "unsupported_tokenization_network", trace_id: traceId }, 400);
  }
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

  let tagId = "";
  let sourceEventCreatedAt: string | Date | null = null;
  try {
    const identityRows = await sql/*sql*/`
      SELECT tag.id AS tag_id, event.created_at AS source_event_created_at
      FROM events event
      JOIN batches batch
        ON batch.id = event.batch_id
       AND batch.tenant_id = event.tenant_id
      JOIN tags tag
        ON tag.batch_id = event.batch_id
       AND UPPER(tag.uid_hex) = UPPER(event.uid_hex)
      WHERE event.id = ${eventId}::bigint
        AND event.tenant_id = ${tenantId}::uuid
        AND event.batch_id = ${batchId}::uuid
        AND batch.bid = ${bid}
        AND UPPER(event.uid_hex) = UPPER(${uid})
      LIMIT 2
    `;
    if (identityRows.length !== 1 || !identityRows[0]?.tag_id) {
      return json({ ok: false, reason: "tokenization_asset_identity_mismatch", trace_id: traceId }, 409);
    }
    tagId = String(identityRows[0].tag_id);
    sourceEventCreatedAt = identityRows[0].source_event_created_at as string | Date | null;
    if (!sourceEventCreatedAt) {
      return json({ ok: false, reason: "tokenization_event_time_identity_missing", trace_id: traceId }, 409);
    }
  } catch (error) {
    if (isTokenizationCommercialScopeSchemaError(error)) {
      return json({ ok: false, reason: TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED, trace_id: traceId }, 503, {
        "cache-control": "no-store",
        "retry-after": "2",
      });
    }
    throw error;
  }

  const existingRows = await sql/*sql*/`
    SELECT id, tenant_id, batch_id, tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class,
           status, requested_at, network, asset_ref, issuer_wallet, anchor_hash, tx_hash, token_id, last_error, next_attempt_at
    FROM tokenization_requests
    WHERE tenant_id = ${tenantId}::uuid
      AND batch_id = ${batchId}::uuid
      AND tag_id = ${tagId}::uuid
      AND bid = ${bid}
      AND uid_hex = ${uid}
      AND execution_class = ${executionClass}
      AND network = ${ledger.ledger_network}
      AND status IN ('pending', 'processing', 'reconciling', 'failed', 'anchored', 'simulated', 'blocked')
    ORDER BY requested_at DESC
    LIMIT 1
  `;
  const existingRequest = existingRows[0];
  if (existingRequest) {
    const requestedEvent = await ensureCanonicalRequestedEvent(existingRequest);
    if (!requestedEvent.ok) {
      return json({
        ok: false,
        reason: requestedEvent.reason,
        operation_committed: true,
        tokenization_request: publicTokenizationRequest(existingRequest),
        trace_id: traceId,
      }, 503, { "cache-control": "no-store", "retry-after": "2" });
    }
    const alreadyAnchored = String(existingRequest.status || "") === "anchored";
    const anchor = alreadyAnchored
      ? (await anchorTokenizationRequest({
          requestId: String(existingRequest.id || ""),
          tenantId,
          network: ledger.ledger_network,
          issuerWallet: ledger.issuer_wallet,
          processor: "public_cta_anchored_event_repair",
        }) as AnchorResult)
      : ((await maybeAnchorPublicRequest(String(existingRequest.id || ""), tenantId, ledger.ledger_network, ledger.issuer_wallet)) as AnchorResult | null);
    const latestRequest = await loadTokenizationRequest(String(existingRequest.id || ""), tenantId);
    const outcome = tokenizationOutcome(latestRequest || existingRequest, anchor);
    const canonicalUnavailable = anchor?.canonical_event_confirmed === false;
    return json({
      action: "tokenize_request",
      deduplicated: true,
      reason: outcome.tokenization_status === "anchored"
          ? "existing request anchored"
          : outcome.tokenization_status === "simulated"
            ? "existing request simulated without blockchain"
            : outcome.tokenization_status === "blocked"
              ? "existing request blocked by runtime policy"
          : outcome.tokenization_status === "failed"
            ? "existing request failed"
            : outcome.tokenization_status === "reconciling"
              ? "existing request awaiting reconciliation without redispatch"
              : "existing request pending review",
      tokenization_request: publicTokenizationRequest(latestRequest || existingRequest),
      anchor,
      ...outcome,
      ok: canonicalUnavailable ? false : outcome.ok,
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
      tokenization_policy: serverPolicy,
      tokenization_policy_source: target.tokenizationPolicySource,
      canonical_event: requestedEvent.receipt,
      operation_committed: canonicalUnavailable ? true : undefined,
    }, canonicalUnavailable ? 503 : outcome.ok ? 200 : 502, canonicalUnavailable ? { "cache-control": "no-store", "retry-after": "2" } : undefined);
  }

  const reqRows = await sql/*sql*/`
    INSERT INTO tokenization_requests (
      tenant_id, batch_id, tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class,
      status, network, asset_ref, issuer_wallet, anchor_hash, requested_by, next_attempt_at, meta
    ) VALUES (
      ${tenantId},
      ${batchId},
      ${tagId},
      ${eventId}::bigint,
      ${sourceEventCreatedAt},
      ${bid},
      ${uid},
      ${executionClass},
      'pending',
      ${ledger.ledger_network},
      ${ledger.asset_ref},
      ${ledger.issuer_wallet},
      ${ledger.anchor_hash},
      'public_cta',
      now(),
      ${JSON.stringify({ trace_id: traceId, share_token_status: auth.share_token_status, fresh_handoff_exp: fresh.payload.exp, execution_class: executionClass, ...policyMeta })}::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id, tenant_id, batch_id, tag_id, source_event_id, source_event_created_at,
              bid, uid_hex, execution_class, status, network, requested_at
  `;
  const createdRequest = reqRows[0] || null;
  const tokenizationRequest = createdRequest || (await sql/*sql*/`
    SELECT id, tenant_id, batch_id, tag_id, source_event_id, source_event_created_at,
           bid, uid_hex, execution_class, status, network, requested_at
    FROM tokenization_requests
    WHERE tenant_id = ${tenantId}::uuid
      AND tag_id = ${tagId}::uuid
      AND execution_class = ${executionClass}
      AND network = ${ledger.ledger_network}
      AND status IN ('pending', 'processing', 'reconciling', 'failed', 'anchored', 'blocked')
    ORDER BY requested_at DESC, id DESC
    LIMIT 1
  `)[0];
  if (!tokenizationRequest?.id) {
    return json({ ok: false, reason: "tokenization_request_creation_conflict", trace_id: traceId }, 409, {
      "cache-control": "no-store",
    });
  }
  const requestedEvent = await ensureCanonicalRequestedEvent(tokenizationRequest as TokenizationEventRecord);
  if (!requestedEvent.ok) {
    return json({
      ok: false,
      reason: requestedEvent.reason,
      operation_committed: true,
      tokenization_request: publicTokenizationRequest(tokenizationRequest),
      trace_id: traceId,
    }, 503, { "cache-control": "no-store", "retry-after": "2" });
  }
  const anchor = (await maybeAnchorPublicRequest(String(tokenizationRequest?.id || ""), tenantId, ledger.ledger_network, ledger.issuer_wallet)) as AnchorResult | null;
  const latestRequest = await loadTokenizationRequest(String(tokenizationRequest?.id || ""), tenantId);
  const outcome = tokenizationOutcome(latestRequest || tokenizationRequest, anchor);
  const canonicalUnavailable = anchor?.canonical_event_confirmed === false;
  return json({
    action: "tokenize_request",
    deduplicated: !createdRequest,
    id: requestedEvent.receipt.canonicalOperationId,
    created_at: requestedEvent.receipt.eventCreatedAt,
    ledger,
    tokenization_request: publicTokenizationRequest(latestRequest || tokenizationRequest),
    anchor,
    ...outcome,
    ok: canonicalUnavailable ? false : outcome.ok,
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
    tokenization_policy: serverPolicy,
    tokenization_policy_source: target.tokenizationPolicySource,
    canonical_event: requestedEvent.receipt,
    operation_committed: canonicalUnavailable ? true : undefined,
  }, canonicalUnavailable ? 503 : outcome.ok ? (createdRequest ? 201 : 200) : 502, canonicalUnavailable ? { "cache-control": "no-store", "retry-after": "2" } : undefined);
}
