export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../lib/db";
import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";

function normalizeUid(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const bid = String(body.bid || body.batchId || "").trim();
  const uids = Array.isArray(body.uids)
    ? body.uids.map(normalizeUid).filter(Boolean)
    : String(body.uids || "")
        .split(/[\s,\n]+/)
        .map(normalizeUid)
        .filter(Boolean);
  const count = Number(body.count || body.quantity || 0);
  const activateAll = body.all === true;

  if (!bid || (!uids.length && count <= 0 && !activateAll)) {
    return json({ ok: false, reason: "bid and either uids, quantity/count, or all=true required" }, 400);
  }

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.status
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      LIMIT 1
    `
    : await sql/*sql*/`
      SELECT id, status
      FROM batches
      WHERE bid = ${bid}
      LIMIT 1
    `;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  // Validate batch status
  const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
  if (!allowedStatuses.includes(batch.status)) {
    return json({
      ok: false,
      reason: 'invalid_batch_state',
      message: `Cannot activate tags while batch status is '${batch.status}'. Batch status must be 'production_registered' or 'active_in_market'.`
    }, 400);
  }

  let targetUids = Array.from(new Set(uids));
  if (!targetUids.length && (count > 0 || activateAll)) {
    const candidates = activateAll
      ? await sql/*sql*/`
          SELECT uid_hex
          FROM tags
          WHERE batch_id = ${batch.id} AND status = 'inactive'
          ORDER BY created_at ASC, uid_hex ASC
        `
      : await sql/*sql*/`
          SELECT uid_hex
          FROM tags
          WHERE batch_id = ${batch.id} AND status = 'inactive'
          ORDER BY created_at ASC, uid_hex ASC
          LIMIT ${Math.max(0, Math.trunc(count))}
        `;
    targetUids = candidates.map((row) => String(row.uid_hex || "")).filter(Boolean);
  }

  if (!targetUids.length) {
    return json({ ok: false, reason: "no tags available to activate" }, 400);
  }

  const updated = await sql/*sql*/`
    UPDATE tags
    SET status = 'active'
    WHERE batch_id = ${batch.id} AND uid_hex = ANY(${targetUids})
    RETURNING uid_hex
  `;

  const remaining = await sql/*sql*/`
    SELECT COUNT(*)::int AS count
    FROM tags
    WHERE batch_id = ${batch.id} AND status = 'inactive'
  `;

  return json({
    ok: true,
    batch: bid,
    requested: targetUids.length,
    activated: updated.length,
    uids: updated.map((row) => row.uid_hex),
    remainingInactive: Number(remaining[0]?.count || 0),
  });
}
