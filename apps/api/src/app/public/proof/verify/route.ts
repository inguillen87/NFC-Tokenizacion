export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { verifyHashInAnchor } from "../../../../lib/proof-layer";

export async function GET(req: Request) {
  await ensureSupplierOpsSchema();
  const url = new URL(req.url);
  const eventHash = String(url.searchParams.get("event_hash") || url.searchParams.get("hash") || "").trim();
  const anchorId = String(url.searchParams.get("anchor_id") || url.searchParams.get("anchorId") || "").trim();
  if (!eventHash) return json({ ok: false, reason: "event_hash_required" }, 400);

  const rows = anchorId
    ? await sql/*sql*/`
        SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at
        FROM evidence_anchors
        WHERE id = ${anchorId}::uuid
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at
        FROM evidence_anchors
        ORDER BY created_at DESC
        LIMIT 250
      `;
  const matches = rows
    .filter((anchor) => verifyHashInAnchor(eventHash, Array.isArray(anchor.event_hashes_json) ? anchor.event_hashes_json : []))
    .map((anchor) => ({
      anchor_id: anchor.id,
      provider: anchor.provider,
      network: anchor.network,
      merkle_root: anchor.merkle_root,
      tx_hash: anchor.tx_hash || null,
      explorer_url: anchor.explorer_url || null,
      status: anchor.status,
      anchored_at: anchor.anchored_at || anchor.created_at,
    }));

  return json({
    ok: true,
    valid: matches.length > 0,
    event_hash: eventHash,
    matches,
    privacy: "Verification is hash-only; no raw product, customer or business data is exposed.",
  });
}
