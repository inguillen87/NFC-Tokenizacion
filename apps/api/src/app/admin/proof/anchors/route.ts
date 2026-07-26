export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdmin, checkAdminPermission } from "../../../../lib/auth";
import { resolveAdminProofTenantScope } from "../../../../lib/admin-proof-tenant-scope";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import {
  IOTA_EVIDENCE_CONTRACT_VERSION,
  IOTA_EVIDENCE_MERKLE_ALGORITHM,
  computeIotaEvidenceProofId,
  inspectIotaEvidenceTarget,
  prepareIotaEvidence,
  resolveIotaEvidenceRuntimeConfig,
} from "../../../../lib/iota-evidence-writer";
import { processIotaEvidenceAnchor } from "../../../../lib/iota-evidence-reconciler";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

type AnchorProvider = "iota" | "polygon";

type EvidenceEventRow = {
  id: string;
  payload_hash: string;
  resource_type: string;
  resource_id: string;
};

function safeString(value: unknown) {
  return String(value || "").trim();
}

function enabled(value: unknown) {
  return ["1", "true", "yes", "on"].includes(safeString(value).toLowerCase());
}

function normalizeProvider(value: unknown): AnchorProvider {
  return safeString(value || "iota").toLowerCase() === "polygon" ? "polygon" : "iota";
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(safeString).filter(Boolean);
}

function idempotencyKeyHash(tenantId: string, value: unknown) {
  const key = safeString(value);
  if (!key) return null;
  if (key.length > 200 || /[\u0000-\u001f\u007f]/.test(key)) throw new Error("idempotency_key_invalid");
  return `sha256:${createHash("sha256").update(`${tenantId}\u0000${key}`, "utf8").digest("hex")}`;
}

function responseStatus(anchor: Record<string, unknown>, created: boolean) {
  const status = safeString(anchor.status).toLowerCase();
  if (status === "confirmed") return created ? 201 : 200;
  if (["pending", "submitted", "reconciling"].includes(status)) return 202;
  return 502;
}

function publicAnchor(anchor: Record<string, unknown>) {
  return {
    id: anchor.id,
    provider: anchor.provider,
    network: anchor.network,
    resource_type: anchor.resource_type,
    resource_id: anchor.resource_id,
    public_resource_id: anchor.public_resource_id,
    merkle_root: anchor.merkle_root,
    event_count: anchor.event_count,
    status: anchor.status,
    proof_id: anchor.proof_id,
    memo_hash: anchor.memo_hash,
    contract_version: anchor.contract_version,
    chain_id: anchor.chain_id,
    contract_address: anchor.contract_address,
    publisher_address: anchor.publisher_address,
    tx_hash: anchor.tx_hash,
    explorer_url: anchor.explorer_url,
    confirmations: anchor.confirmations,
    submitted_at: anchor.submitted_at,
    confirmed_at: anchor.confirmed_at,
    anchored_at: anchor.anchored_at,
    created_at: anchor.created_at,
    updated_at: anchor.updated_at,
  };
}

async function eventRowsFromIds(eventIds: string[], tenantId: string) {
  if (!eventIds.length) return [];
  const rows = await sql/*sql*/`
    SELECT id::text, payload_hash, resource_type, resource_id
    FROM evidence_events
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ANY(${eventIds}::uuid[])
    ORDER BY created_at ASC, id ASC
  `;
  if (rows.length !== new Set(eventIds).size) throw new Error("evidence_event_not_found");
  return rows as EvidenceEventRow[];
}

export async function GET(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "proof:read");
  if (permission) return permission;
  await ensureSupplierOpsSchema();

  const url = new URL(req.url);
  const requestedTenant = url.searchParams.get("tenant") || "";
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) {
    return json({ ok: false, reason: "tenant_not_found", anchors: [] }, 404);
  }
  const tenantId = tenantScope.tenantId;

  const rows = tenantId
    ? await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, public_resource_id,
               merkle_root, event_hashes_json, tx_hash, explorer_url, status, error_code,
               anchored_at, submitted_at, confirmed_at, created_at, updated_at, event_count,
               proof_id, memo_hash, contract_version, chain_id, contract_address,
               publisher_address, confirmations, attempt_count, next_attempt_at
        FROM evidence_anchors
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, public_resource_id,
               merkle_root, event_hashes_json, tx_hash, explorer_url, status, error_code,
               anchored_at, submitted_at, confirmed_at, created_at, updated_at, event_count,
               proof_id, memo_hash, contract_version, chain_id, contract_address,
               publisher_address, confirmations, attempt_count, next_attempt_at
        FROM evidence_anchors
        ORDER BY created_at DESC
        LIMIT 100
      `;

  return json({ ok: true, anchors: rows });
}

export async function POST(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "proof:write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = normalizeProvider(body.provider);
  const network = safeString(body.network) || (provider === "iota" ? "testnet" : "amoy");
  const requestedTenant = safeString(body.tenant_id || body.tenantId || body.tenant_slug || body.tenantSlug || body.tenant);
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) return json({ ok: false, reason: "tenant_not_found" }, 404);
  if (!tenantScope.requested || !tenantScope.tenantId) return json({ ok: false, reason: "tenant_required" }, 400);
  const tenantId = tenantScope.tenantId;

  const providerRows = await sql/*sql*/`
    SELECT code, network, chain_id, enabled
    FROM ledger_providers
    WHERE code = ${provider} AND network = ${network}
    LIMIT 1
  `;
  const ledgerProvider = providerRows[0];
  if (!ledgerProvider) return json({ ok: false, reason: "ledger_provider_not_configured", provider, network }, 404);
  if (!ledgerProvider.enabled) return json({ ok: false, reason: "ledger_provider_disabled", provider, network }, 409);
  if (provider === "polygon") {
    return json({
      ok: false,
      reason: "polygon_ownership_route_required",
      message: "Polygon ownership is managed through tokenization, not the evidence anchor route.",
    }, 409);
  }

  const eventIds = normalizeStringList(body.event_ids || body.eventIds);
  const directHashes = [
    ...normalizeStringList(body.event_hashes),
    ...normalizeStringList(body.eventHashes),
  ];
  if (!eventIds.length && !directHashes.length) {
    return json({ ok: false, reason: "event_ids_required" }, 400);
  }
  if (eventIds.length && directHashes.length) {
    return json({ ok: false, reason: "event_source_ambiguous" }, 400);
  }
  if (directHashes.length && String(process.env.NODE_ENV || "").toLowerCase() === "production"
    && !enabled(process.env.IOTA_ALLOW_DIRECT_EVENT_HASHES)) {
    return json({ ok: false, reason: "direct_event_hashes_forbidden" }, 403);
  }

  let eventRows: EvidenceEventRow[] = [];
  try {
    eventRows = await eventRowsFromIds(eventIds, tenantId);
  } catch (error) {
    const reason = error instanceof Error && error.message === "evidence_event_not_found"
      ? "evidence_event_not_found"
      : "event_id_invalid";
    return json({ ok: false, reason }, reason === "evidence_event_not_found" ? 404 : 400);
  }
  const resourceKeys = new Set(eventRows.map((event) => `${event.resource_type}\u0000${event.resource_id}`));
  if (resourceKeys.size > 1) return json({ ok: false, reason: "mixed_resource_events" }, 400);
  const eventResourceType = eventRows[0]?.resource_type || "";
  const eventResourceId = eventRows[0]?.resource_id || "";
  const resourceType = safeString(body.resourceType || body.resource_type || eventResourceType);
  const resourceId = safeString(body.resourceId || body.resource_id || eventResourceId);
  const publicResourceId = safeString(body.publicResourceId || body.public_resource_id);
  if (eventResourceType && resourceType !== eventResourceType) return json({ ok: false, reason: "event_resource_type_mismatch" }, 400);
  if (eventResourceId && resourceId !== eventResourceId) return json({ ok: false, reason: "event_resource_id_mismatch" }, 400);

  const canonicalizationVersion = eventRows.length
    ? "nexid-event-order-created-at-id-v1"
    : "nexid-event-hash-set-lexicographic-v1";
  let prepared;
  try {
    prepared = prepareIotaEvidence({
      tenantId,
      resourceType,
      publicResourceId,
      eventHashes: eventRows.length ? eventRows.map((event) => event.payload_hash) : directHashes,
      canonicalizationVersion,
      preserveEventOrder: Boolean(eventRows.length),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "iota_evidence_invalid";
    return json({ ok: false, reason }, 400);
  }
  const requestedMerkleRoot = safeString(body.merkleRoot || body.merkle_root).toLowerCase();
  if (requestedMerkleRoot && requestedMerkleRoot !== prepared.merkleRoot) {
    return json({ ok: false, reason: "merkle_root_mismatch", expected: prepared.merkleRoot, received: requestedMerkleRoot }, 400);
  }

  const config = resolveIotaEvidenceRuntimeConfig();
  if (config.mode === "disabled") {
    return json({ ok: false, reason: "ledger_provider_runtime_disabled", provider, network }, 409);
  }
  if (config.mode === "mock" && String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    return json({ ok: false, reason: "mock_provider_forbidden_in_production", provider, network }, 409);
  }
  if (!config.contractAddress) return json({ ok: false, reason: "iota_v2_contract_missing", provider, network }, 503);

  let target;
  try {
    target = config.mode === "mock"
      ? {
          chainId: config.expectedChainId,
          contractAddress: config.contractAddress,
          contractVersion: IOTA_EVIDENCE_CONTRACT_VERSION,
          proofId: computeIotaEvidenceProofId({
            chainId: config.expectedChainId,
            contractAddress: config.contractAddress,
            merkleRoot: prepared.merkleRoot,
            tenantIdHash: prepared.tenantIdHash,
            resourceType: prepared.resourceType,
            resourceId: prepared.publicResourceId,
            eventCount: prepared.eventCount,
            memoHash: prepared.memoHash,
          }),
          alreadyAnchored: false,
          publisherAddress: null,
          anchoredAt: null,
        }
      : await inspectIotaEvidenceTarget(prepared, config);
  } catch (error) {
    const reason = error instanceof Error && /^[a-z0-9_]+$/i.test(error.message)
      ? error.message
      : "iota_v2_preflight_failed";
    return json({ ok: false, reason, provider, network }, 503);
  }
  if (ledgerProvider.chain_id && Number(ledgerProvider.chain_id) !== target.chainId) {
    return json({ ok: false, reason: "ledger_provider_chain_id_mismatch", provider, network }, 503);
  }

  let idempotencyKey: string | null;
  try {
    idempotencyKey = idempotencyKeyHash(tenantId, req.headers.get("idempotency-key"));
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "idempotency_key_invalid" }, 400);
  }

  const memberPayload = prepared.eventHashes.map((eventHash, leafIndex) => ({
    event_id: eventRows[leafIndex]?.id || null,
    event_hash: eventHash,
    leaf_index: leafIndex,
  }));
  const insertedRows = await sql/*sql*/`
    WITH inserted_anchor AS (
      INSERT INTO evidence_anchors (
        tenant_id, provider, network, anchor_type, resource_type, resource_id, public_resource_id,
        merkle_root, event_count, event_hashes_json, status, contract_version, chain_id,
        contract_address, tenant_id_hash, canonicalization_version, merkle_algorithm,
        memo_hash, memo_json, proof_id, idempotency_key, last_checked_at, updated_at
      ) VALUES (
        ${tenantId}::uuid, 'iota', ${network}, 'merkle_root', ${prepared.resourceType}, ${resourceId}, ${prepared.publicResourceId},
        ${prepared.merkleRoot}, ${prepared.eventCount}, ${JSON.stringify(prepared.eventHashes)}::jsonb, 'pending',
        ${IOTA_EVIDENCE_CONTRACT_VERSION}, ${target.chainId}, ${target.contractAddress},
        ${`sha256:${prepared.tenantIdHash}`}, ${prepared.canonicalizationVersion}, ${IOTA_EVIDENCE_MERKLE_ALGORITHM},
        ${prepared.memoHash}, ${JSON.stringify(prepared.memo)}::jsonb, ${target.proofId}, ${idempotencyKey}, now(), now()
      )
      ON CONFLICT DO NOTHING
      RETURNING *
    ),
    inserted_members AS (
      INSERT INTO evidence_anchor_members (anchor_id, event_id, event_hash, leaf_index)
      SELECT
        inserted_anchor.id,
        NULLIF(member.event_id, '')::uuid,
        member.event_hash,
        member.leaf_index
      FROM inserted_anchor
      CROSS JOIN LATERAL jsonb_to_recordset(${JSON.stringify(memberPayload)}::jsonb)
        AS member(event_id text, event_hash text, leaf_index integer)
      RETURNING anchor_id
    )
    SELECT inserted_anchor.*,
           (SELECT COUNT(*)::integer FROM inserted_members) AS inserted_member_count
    FROM inserted_anchor
  `;
  const created = Boolean(insertedRows[0]);
  let anchor = insertedRows[0] as Record<string, unknown> | undefined;
  if (created && Number(anchor?.inserted_member_count) !== prepared.eventCount) {
    return json({ ok: false, reason: "evidence_anchor_members_incomplete" }, 500);
  }

  if (!anchor) {
    const existingRows = await sql/*sql*/`
      SELECT *
      FROM evidence_anchors
      WHERE tenant_id = ${tenantId}::uuid
        AND provider = 'iota'
        AND network = ${network}
        AND (
          lower(proof_id) = lower(${target.proofId})
          OR (${idempotencyKey}::text IS NOT NULL AND lower(idempotency_key) = lower(${idempotencyKey}))
        )
      ORDER BY created_at ASC
      LIMIT 1
    `;
    anchor = existingRows[0];
    if (!anchor) return json({ ok: false, reason: "iota_anchor_identity_conflict" }, 409);
    if (safeString(anchor.proof_id).toLowerCase() !== target.proofId.toLowerCase()) {
      return json({ ok: false, reason: "idempotency_key_conflict" }, 409);
    }
    const existingStatus = safeString(anchor.status).toLowerCase();
    if (["confirmed", "failed", "pending", "submitted", "reconciling"].includes(existingStatus)) {
      return json({
        ok: existingStatus !== "failed",
        idempotent_replay: true,
        queued: ["pending", "submitted", "reconciling"].includes(existingStatus),
        anchor: publicAnchor(anchor),
        event_hashes: prepared.eventHashes,
      }, responseStatus(anchor, false));
    }
  }

  if (config.mode === "mock") {
    const mockTxHash = `mock-iota-v2-${target.proofId.slice(2, 18)}`;
    const mockRows = await sql/*sql*/`
      UPDATE evidence_anchors
      SET status = 'submitted',
          tx_hash = ${mockTxHash},
          submitted_at = now(),
          updated_at = now(),
          error_code = 'mock_test_only',
          error_message = 'mock_test_only'
      WHERE id = ${anchor.id}::uuid
      RETURNING *
    `;
    anchor = mockRows[0];
  } else {
    const processed = await processIotaEvidenceAnchor(String(anchor.id), tenantId);
    anchor = (processed.anchor || anchor) as Record<string, unknown>;
  }

  await logAuditEvent({
    actorId: req.headers.get("x-nexid-actor-id"),
    tenantId,
    action: "proof_anchor_iota_v2_created",
    resourceType: "evidence_anchor",
    resourceId: String(anchor.id),
    afterData: {
      provider: "iota",
      network,
      resource_type: prepared.resourceType,
      public_resource_id: prepared.publicResourceId,
      merkle_root: prepared.merkleRoot,
      event_count: prepared.eventCount,
      status: anchor.status,
      proof_id: target.proofId,
      memo_hash: prepared.memoHash,
      tx_hash: anchor.tx_hash || null,
      contract_version: IOTA_EVIDENCE_CONTRACT_VERSION,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  const status = responseStatus(anchor, true);
  return json({
    ok: safeString(anchor.status) !== "failed",
    idempotent_replay: false,
    queued: status === 202,
    anchor: publicAnchor(anchor),
    event_hashes: prepared.eventHashes,
    warning: config.mode === "mock"
      ? "Mock IOTA V2 proof for local testing only. It is not external evidence."
      : null,
  }, status);
}
