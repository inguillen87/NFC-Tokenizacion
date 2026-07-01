export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const url = new URL(req.url);
  const requestedTenant = url.searchParams.get("tenant") || "";
  
  let tenantId: string | null = null;
  if (forcedTenantSlug) {
    const rows = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  } else if (requestedTenant) {
    const rows = /^[0-9a-f-]{36}$/i.test(requestedTenant)
      ? await sql/*sql*/`SELECT id FROM tenants WHERE id = ${requestedTenant}::uuid LIMIT 1`
      : await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${requestedTenant.toLowerCase()} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  }

  const rows = tenantId
    ? await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, merkle_root, tx_hash, explorer_url, status, anchored_at, created_at, event_count
        FROM evidence_anchors
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT id, provider, network, anchor_type, resource_type, resource_id, merkle_root, tx_hash, explorer_url, status, anchored_at, created_at, event_count
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
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { merkleRoot, tenantIdHash, resourceType, resourceId, eventCount, tenantId } = body;

  if (!merkleRoot || !tenantIdHash || !resourceType || !resourceId || eventCount === undefined) {
    return json({ ok: false, reason: "missing_fields" }, 400);
  }

  const rpcUrl = process.env.IOTA_EVM_RPC_URL || "https://json-rpc.evm.testnet.iotaledger.net";
  const privateKey = process.env.IOTA_EVM_PRIVATE_KEY;
  const contractAddress = process.env.IOTA_EVM_ANCHOR_CONTRACT;
  const explorerUrl = process.env.IOTA_EXPLORER_BASE_URL || "https://explorer.evm.testnet.iotaledger.net/tx/";

  let txHash = "";
  let status = "submitted";
  let errorMessage = null;

  if (privateKey && contractAddress && rpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // We have LogisticsEventAnchor.sol
      const abi = [
        "function anchorRoot(bytes32 merkleRoot, string calldata tenantIdHash, string calldata resourceType, string calldata resourceId, uint256 eventCount) external"
      ];
      
      const contract = new ethers.Contract(contractAddress, abi, wallet);
      const tx = await contract.anchorRoot(merkleRoot, tenantIdHash, resourceType, resourceId, eventCount);
      const receipt = await tx.wait();
      
      txHash = receipt.hash;
      status = "confirmed";
    } catch (err: any) {
      status = "failed";
      errorMessage = err.message || "Unknown error";
    }
  } else {
    // Mock mode or missing config
    txHash = "mock-iota-tx-" + Date.now();
    status = "confirmed";
  }

  const anchorRows = await sql/*sql*/`
    INSERT INTO evidence_anchors (
      tenant_id, provider, network, anchor_type, resource_type, resource_id, merkle_root, event_count, tx_hash, explorer_url, status, anchored_at
    ) VALUES (
      ${tenantId ? String(tenantId) : null}, 'iota', 'testnet', 'merkle_root', ${resourceType ? String(resourceType) : null}, ${resourceId ? String(resourceId) : null}, ${String(merkleRoot)}, ${Number(eventCount)}, ${txHash}, ${explorerUrl + txHash}, ${status}, now()
    )
    RETURNING *
  `;

  return json({
    ok: true,
    anchor: anchorRows[0]
  }, 201);
}
