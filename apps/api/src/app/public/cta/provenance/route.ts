import { json } from "../../../../lib/http";
import { buildLifecycleState, listDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { sql } from "../../../../lib/db";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

async function durableRow<T extends Record<string, unknown>>(query: Promise<T[]>) {
  try {
    const rows = await query;
    return { available: true as const, row: rows[0] || null };
  } catch (error) {
    console.warn("[public_provenance] durable registry read unavailable", error instanceof Error ? error.name : "unknown_error");
    return { available: false as const, row: null };
  }
}

export async function GET(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "public-proof",
    subjectId: "cta-provenance:public",
  });
  if (limited) return limited;
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
  const durableScopeAvailable = Boolean(target.tenantId && target.batchId);
  const [ownershipRead, tokenizationRead, anchorRead] = durableScopeAvailable
    ? await Promise.all([
        durableRow(sql/*sql*/`
          SELECT status, source, claimed_at, updated_at
          FROM consumer_product_ownerships
          WHERE tenant_id = ${target.tenantId}
            AND batch_id = ${target.batchId}
            AND upper(uid_hex) = ${uid.toUpperCase()}
          ORDER BY updated_at DESC
          LIMIT 1
        `),
        durableRow(sql/*sql*/`
          SELECT status, network, tx_hash, token_id, anchor_hash, asset_ref, requested_at, processed_at,
            COALESCE(processed_at, requested_at) AS updated_at
          FROM tokenization_requests
          WHERE tenant_id = ${target.tenantId}
            AND batch_id = ${target.batchId}
            AND bid = ${bid}
            AND upper(uid_hex) = ${uid.toUpperCase()}
          ORDER BY COALESCE(processed_at, requested_at) DESC
          LIMIT 1
        `),
        durableRow(sql/*sql*/`
          SELECT provider, network, status, tx_hash, explorer_url, anchored_at, confirmed_at, updated_at
          FROM evidence_anchors
          WHERE tenant_id = ${target.tenantId}
            AND (resource_id = ${target.batchId} OR resource_id = ${bid} OR public_resource_id = ${bid})
          ORDER BY updated_at DESC
          LIMIT 1
        `),
      ])
    : [
        { available: false as const, row: null },
        { available: false as const, row: null },
        { available: false as const, row: null },
      ];

  const ownershipStatus = ownershipRead.available
    ? String(ownershipRead.row?.status || "not_claimed").toLowerCase()
    : "unavailable";
  const durableOwnership = {
    ownership_status: ownershipStatus,
    claimed: ownershipRead.available ? ownershipStatus === "claimed" : null,
    claimed_at: ownershipRead.row?.claimed_at || null,
    updated_at: ownershipRead.row?.updated_at || null,
    source: ownershipRead.row?.source || null,
    registry: ownershipRead.available ? "consumer_product_ownerships" : "unavailable",
    record_scope: "nexid_off_chain_digital_title",
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    on_chain_owner_verified: false,
    physical_custody_verified: false,
    boundary: "This is a tenant-scoped off-chain digital title record. No NFT transfer is implied, and it does not by itself prove current physical custody.",
  };
  const tokenizationStatus = tokenizationRead.available
    ? String(tokenizationRead.row?.status || "not_requested").toLowerCase()
    : "unavailable";
  const durableLedger = {
    ledger_status: tokenizationStatus,
    ledger_network: tokenizationRead.row?.network || null,
    tx_hash: tokenizationRead.row?.tx_hash || null,
    token_id: tokenizationRead.row?.token_id || null,
    anchor_hash: tokenizationRead.row?.anchor_hash || null,
    asset_ref: tokenizationRead.row?.asset_ref || null,
    requested_at: tokenizationRead.row?.requested_at || null,
    processed_at: tokenizationRead.row?.processed_at || null,
    registry: tokenizationRead.available ? "tokenization_requests" : "unavailable",
    rpc_verified_in_this_response: false,
  };
  const durableAnchor = {
    registry_status: anchorRead.available ? String(anchorRead.row?.status || "not_found") : "unavailable",
    provider: anchorRead.row?.provider || null,
    network: anchorRead.row?.network || null,
    tx_hash: anchorRead.row?.tx_hash || null,
    explorer_url: anchorRead.row?.explorer_url || null,
    anchored_at: anchorRead.row?.anchored_at || null,
    confirmed_at: anchorRead.row?.confirmed_at || null,
    rpc_verified_in_this_response: false,
    boundary: "Registry state is reported from durable storage; use the proof verifier for an RPC network check.",
  };
  const warrantyRequestRecorded = actions.some((entry) => ["warranty_review_requested", "register_warranty"].includes(String(entry.action || "")));
  const problemReportRequestRecorded = actions.some((entry) => ["problem_report_request", "report_problem"].includes(String(entry.action || "")));
  const commercialSignals = {
    ownership_claimed: ownershipRead.available ? ownershipStatus === "claimed" : null,
    warranty_request_recorded: warrantyRequestRecorded,
    warranty_registered: false,
    problem_report_request_recorded: problemReportRequestRecorded,
    support_ticket_created: false,
    tokenization_interest: Boolean(tokenizationRead.row) || actions.some((entry) => String(entry.action || "") === "tokenize_request"),
  };
  const publicActions = actions.map((entry) => {
    const payload = entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)
      ? entry.payload as Record<string, unknown>
      : {};
    return {
      action: String(entry.action || ""),
      created_at: entry.created_at || null,
      request_status: typeof payload.request_status === "string" ? payload.request_status : null,
      provenance: typeof payload.provenance === "string" ? payload.provenance : "legacy_demo_action_log",
    };
  });
  return json({
    ok: true,
    bid,
    uid,
    actions: publicActions,
    ...lifecycle,
    ownership: durableOwnership,
    ledger: durableLedger,
    proof_anchor: durableAnchor,
    timeline: [
      ...lifecycle.timeline,
      { stage: "durable_ownership", status: ownershipStatus, at: durableOwnership.updated_at },
      { stage: "durable_tokenization", status: tokenizationStatus, at: tokenizationRead.row?.updated_at || null },
      { stage: "durable_anchor_registry", status: durableAnchor.registry_status, at: anchorRead.row?.updated_at || null },
    ],
    commercial_signals: commercialSignals,
    action_log_provenance: {
      mode: "demo_action_log",
      warranty_service: "not_connected",
      ticket_service: "not_connected",
      boundary: "Recorded demo requests are pending review; they are not confirmed warranties or created support tickets.",
    },
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
