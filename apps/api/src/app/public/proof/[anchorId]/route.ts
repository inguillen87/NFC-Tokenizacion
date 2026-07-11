export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";

export async function GET(_req: Request, { params }: { params: Promise<{ anchorId: string }> }) {
  const { anchorId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anchorId)) {
    return json({ ok: false, reason: "anchor_id_invalid", message: "anchorId must be a UUID." }, 400);
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
