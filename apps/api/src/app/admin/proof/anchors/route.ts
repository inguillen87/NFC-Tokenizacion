export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { ethers } from "ethers";
import { checkAdmin, checkAdminPermission } from "../../../../lib/auth";
import { resolveAdminProofTenantScope } from "../../../../lib/admin-proof-tenant-scope";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { buildMerkleRoot, isSha256Hash } from "../../../../lib/proof-layer";

type AnchorProvider = "iota" | "polygon";
type IotaProviderMode = "disabled" | "mock" | "iota_evm_contract" | "iota_notarization_sdk_later";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeProvider(value: unknown): AnchorProvider {
  const provider = safeString(value || "iota").toLowerCase();
  return provider === "polygon" ? "polygon" : "iota";
}

function normalizeIotaMode(): IotaProviderMode {
  const mode = safeString(process.env.IOTA_PROVIDER_MODE || process.env.IOTA_PROOF_MODE || "disabled").toLowerCase();
  if (mode === "mock" || mode === "iota_evm_contract" || mode === "iota_notarization_sdk_later") return mode;
  return "disabled";
}

function stripShaPrefix(value: string) {
  return value.replace(/^sha256:/i, "").trim().toLowerCase();
}

function tenantHash(value: string | null) {
  return createHash("sha256").update(value || "public", "utf8").digest("hex");
}

function normalizeEventHashes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(safeString).filter(Boolean);
}

async function eventHashesFromIds(eventIds: string[], tenantId: string | null) {
  if (!eventIds.length) return [];
  const rows = tenantId
    ? await sql/*sql*/`
        SELECT payload_hash
        FROM evidence_events
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ANY(${eventIds}::uuid[])
        ORDER BY created_at ASC
      `
    : await sql/*sql*/`
        SELECT payload_hash
        FROM evidence_events
        WHERE id = ANY(${eventIds}::uuid[])
        ORDER BY created_at ASC
      `;
  return rows.map((row: Record<string, unknown>) => safeString(row.payload_hash)).filter(Boolean);
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
        SELECT id, provider, network, anchor_type, resource_type, resource_id, merkle_root, event_hashes_json, tx_hash, explorer_url, status, error_message, anchored_at, created_at, event_count
        FROM evidence_anchors
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, merkle_root, event_hashes_json, tx_hash, explorer_url, status, error_message, anchored_at, created_at, event_count
        FROM evidence_anchors
        ORDER BY created_at DESC
        LIMIT 100
      `;

  return json({
    ok: true,
    anchors: rows,
  });
}

export async function POST(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "proof:write");
  if (permission) return permission;
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = normalizeProvider(body.provider);
  const network = safeString(body.network) || (provider === "iota" ? "testnet" : "amoy");
  const requestedTenant = safeString(body.tenant_id || body.tenantId || body.tenant_slug || body.tenantSlug || body.tenant);
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) {
    return json({ ok: false, reason: "tenant_not_found" }, 404);
  }
  if (!tenantScope.requested) {
    return json({ ok: false, reason: "tenant_required" }, 400);
  }
  const tenantId = tenantScope.tenantId;
  const resourceType = safeString(body.resourceType || body.resource_type);
  const resourceId = safeString(body.resourceId || body.resource_id);
  const eventIds = Array.isArray(body.event_ids)
    ? body.event_ids.map(safeString).filter(Boolean)
    : Array.isArray(body.eventIds)
      ? body.eventIds.map(safeString).filter(Boolean)
      : [];
  const eventHashes = [
    ...normalizeEventHashes(body.event_hashes),
    ...normalizeEventHashes(body.eventHashes),
    ...await eventHashesFromIds(eventIds, tenantId),
  ];

  if (!resourceType || !resourceId) {
    return json({ ok: false, reason: "resource_required" }, 400);
  }
  if (!eventHashes.length) {
    return json({ ok: false, reason: "event_hashes_required", message: "External anchors must include event_hashes or event_ids so public verification can prove inclusion." }, 400);
  }

  const invalidHash = eventHashes.find((hash) => !isSha256Hash(hash));
  if (invalidHash) return json({ ok: false, reason: "event_hash_invalid", event_hash: invalidHash }, 400);

  const merkleRoot = buildMerkleRoot(eventHashes);
  const requestedMerkleRoot = safeString(body.merkleRoot || body.merkle_root);
  if (requestedMerkleRoot && requestedMerkleRoot.toLowerCase() !== merkleRoot.toLowerCase()) {
    return json({ ok: false, reason: "merkle_root_mismatch", expected: merkleRoot, received: requestedMerkleRoot }, 400);
  }

  let txHash: string | null = null;
  let explorerUrl: string | null = null;
  let status = "disabled";
  let errorMessage: string | null = null;
  let warning: string | null = null;

  if (provider === "polygon") {
    status = "disabled";
    warning = "Polygon ownership remains separate. Evidence anchors are IOTA/local by policy unless a Polygon proof adapter is explicitly configured.";
  } else {
    const mode = normalizeIotaMode();
    if (mode === "disabled") {
      status = "disabled";
      warning = "IOTA_PROVIDER_MODE=disabled; no transaction was attempted.";
    } else if (mode === "mock") {
      txHash = `mock-iota-${Date.now().toString(36)}`;
      status = "submitted";
      warning = "Mock IOTA proof for local demo only. This is not legal or commercial evidence.";
    } else if (mode === "iota_notarization_sdk_later") {
      status = "disabled";
      warning = "IOTA notarization toolkit adapter is not configured yet.";
    } else {
      const rpcUrl = process.env.IOTA_EVM_RPC_URL;
      const privateKey = process.env.IOTA_EVM_PRIVATE_KEY;
      const contractAddress = process.env.IOTA_EVM_ANCHOR_CONTRACT;
      const explorerBaseUrl = process.env.IOTA_EXPLORER_BASE_URL || "";
      if (!privateKey || !contractAddress || !rpcUrl) {
        status = "failed";
        errorMessage = "iota_evm_config_missing";
      } else {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(privateKey, provider);
          const abi = [
            "function anchorRoot(bytes32 merkleRoot, string calldata tenantIdHash, string calldata resourceType, string calldata resourceId, uint256 eventCount) external",
          ];

          const contract = new ethers.Contract(contractAddress, abi, wallet);
          const tx = await contract.anchorRoot(`0x${stripShaPrefix(merkleRoot)}`, tenantHash(tenantId), resourceType, resourceId, eventHashes.length);
          const receipt = await tx.wait();

          txHash = receipt.hash;
          explorerUrl = explorerBaseUrl ? `${explorerBaseUrl.replace(/\/$/, "")}/tx/${txHash}` : null;
          status = "confirmed";
        } catch (err: any) {
          status = "failed";
          errorMessage = String(err?.message || "iota_anchor_failed").slice(0, 300);
        }
      }
    }
  }

  const anchorRows = await sql/*sql*/`
    INSERT INTO evidence_anchors (
      tenant_id, provider, network, anchor_type, resource_type, resource_id, merkle_root, event_count,
      event_hashes_json, tx_hash, explorer_url, status, anchored_at, error_message
    ) VALUES (
      ${tenantId}, ${provider}, ${network}, 'merkle_root', ${resourceType}, ${resourceId}, ${merkleRoot}, ${eventHashes.length},
      ${JSON.stringify(eventHashes)}::jsonb, ${txHash}, ${explorerUrl}, ${status}, now(), ${errorMessage}
    )
    RETURNING *
  `;
  const anchor = anchorRows[0];

  await logAuditEvent({
    actorId: null,
    tenantId,
    action: "proof_anchor_external_created",
    resourceType: "evidence_anchor",
    resourceId: String(anchor.id),
    afterData: {
      provider,
      network,
      resource_type: resourceType,
      resource_id: resourceId,
      merkle_root: merkleRoot,
      event_count: eventHashes.length,
      status,
      tx_hash: txHash,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    anchor,
    event_hashes: eventHashes,
    warning,
  }, 201);
}
