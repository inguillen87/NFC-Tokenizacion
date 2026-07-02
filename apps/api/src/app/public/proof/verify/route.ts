export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { isSha256Hash, verifyHashInAnchor } from "../../../../lib/proof-layer";

function readText(value: unknown) {
  return String(value || "").trim();
}

async function verifyPublicProof(eventHash: string, anchorId = "") {
  await ensureSupplierOpsSchema();
  if (!eventHash) return json({ ok: false, reason: "event_hash_required" }, 400);
  if (!isSha256Hash(eventHash)) return json({ ok: false, reason: "event_hash_invalid" }, 400);

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

  const firstMatch = matches[0] || null;
  return json({
    ok: true,
    valid: matches.length > 0,
    included: matches.length > 0,
    event_hash: eventHash,
    provider: firstMatch?.provider || null,
    network: firstMatch?.network || null,
    merkle_root: firstMatch?.merkle_root || null,
    tx_hash: firstMatch?.tx_hash || null,
    explorer_url: firstMatch?.explorer_url || null,
    matches,
    privacy: "Verification is hash-only; no raw product, customer or business data is exposed.",
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventHash = readText(url.searchParams.get("event_hash") || url.searchParams.get("hash"));
  const anchorId = readText(url.searchParams.get("anchor_id") || url.searchParams.get("anchorId"));
  return verifyPublicProof(eventHash, anchorId);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventHash = readText(body.event_hash || body.eventHash || body.hash);
  const anchorId = readText(body.anchor_id || body.anchorId);
  return verifyPublicProof(eventHash, anchorId);
}
