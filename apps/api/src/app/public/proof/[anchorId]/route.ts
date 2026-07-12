export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { findPublicProofDemoCaseByAnchorId } from "../../../../lib/public-proof-demos";
import {
  iotaAnchorTenantHash,
  verifyIotaAnchorPublication,
  verifyIotaMemoPublication,
} from "../../../../lib/iota-evm-proof";
import {
  publicProofIotaAnchorTx,
  publicProofIotaExplorerUrl,
  publicProofIotaReceiptTx,
} from "../../../../lib/public-proof-runtime";

function publicNetworkProof(value: Record<string, unknown> | null) {
  if (!value) return null;
  const { input_hex: _inputHex, ...proof } = value;
  return proof;
}

export async function GET(_req: Request, { params }: { params: Promise<{ anchorId: string }> }) {
  const { anchorId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anchorId)) {
    return json({ ok: false, reason: "anchor_id_invalid", message: "anchorId must be a UUID." }, 400);
  }

  const demoCase = findPublicProofDemoCaseByAnchorId(anchorId);
  if (demoCase) {
    const txHash = publicProofIotaAnchorTx(demoCase.id);
    const receiptTxHash = publicProofIotaReceiptTx(demoCase.id);
    const [anchorVerification, receiptVerification] = await Promise.all([
      txHash
        ? verifyIotaAnchorPublication({
            txHash,
            merkleRoot: demoCase.merkle_root,
            tenantIdHash: iotaAnchorTenantHash("public-demo"),
            resourceType: demoCase.resource_type,
            resourceId: demoCase.resource_id,
            eventCount: demoCase.events.length,
          })
        : Promise.resolve(null),
      receiptTxHash
        ? verifyIotaMemoPublication(receiptTxHash, demoCase.public_receipt.on_chain_memo)
        : Promise.resolve(null),
    ]);
    const networkVerified = Boolean(anchorVerification?.verified && receiptVerification?.verified);
    return json({
      ok: true,
      anchor: {
        id: demoCase.anchor_id,
        tenant_slug: "public-demo",
        provider: demoCase.provider,
        network: txHash ? "iota-evm-testnet" : demoCase.network,
        anchor_type: "public_demo_merkle_root",
        merkle_root: demoCase.merkle_root,
        event_count: demoCase.events.length,
        event_hashes: demoCase.events.map((event) => event.hash),
        tx_hash: txHash || null,
        explorer_url: publicProofIotaExplorerUrl(txHash),
        status: networkVerified ? "confirmed" : txHash ? "configured" : "demo_ready",
        anchored_at: demoCase.anchored_at,
        evidence_level: networkVerified ? "testnet_rpc" : "testnet_fixture",
        network_verification: {
          anchor: publicNetworkProof(anchorVerification),
          receipt: publicNetworkProof(receiptVerification),
        },
      },
      public_receipt: {
        title: demoCase.public_receipt.title,
        tx_hash: receiptTxHash || null,
        explorer_url: publicProofIotaExplorerUrl(receiptTxHash),
        decoded_memo: receiptVerification?.memo_matches ? receiptVerification.decoded_memo : null,
        business_claim: demoCase.public_receipt.business_claim,
      },
      privacy: "Only hashes and the public demo memo are exposed. Raw events, identities and tenant internals stay in nexID.",
    }, 200, { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" });
  }

  try {
    await ensureSupplierOpsSchema();
    const rows = await sql/*sql*/`
      SELECT
        ea.id,
        ea.provider,
        ea.network,
        ea.anchor_type,
        ea.merkle_root,
        ea.event_count,
        ea.event_hashes_json,
        ea.tx_hash,
        ea.explorer_url,
        ea.status,
        ea.anchored_at,
        ea.created_at,
        t.slug AS tenant_slug
      FROM evidence_anchors ea
      LEFT JOIN tenants t ON t.id = ea.tenant_id
      WHERE ea.id = ${anchorId}::uuid
      LIMIT 1
    `;
    const anchor = rows[0];
    if (!anchor) return json({ ok: false, reason: "anchor_not_found" }, 404);

    return json({
      ok: true,
      anchor: {
        id: anchor.id,
        tenant_slug: anchor.tenant_slug || null,
        provider: anchor.provider,
        network: anchor.network,
        anchor_type: anchor.anchor_type,
        merkle_root: anchor.merkle_root,
        event_count: anchor.event_count,
        event_hashes: anchor.event_hashes_json || [],
        tx_hash: anchor.tx_hash || null,
        explorer_url: anchor.explorer_url || null,
        status: anchor.status,
        anchored_at: anchor.anchored_at || anchor.created_at,
      },
      privacy: "Only hashes are public. Raw events, customer data and tenant internals stay in nexID.",
    });
  } catch {
    return json({ ok: false, reason: "anchor_registry_unavailable" }, 503);
  }
}
