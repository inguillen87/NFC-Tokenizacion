export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin, getAdminTenantScope } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const limit = Math.max(0, Math.trunc(Number(body.limit || 0)));

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const batchRows = forcedTenantSlug
    ? await sql`
      SELECT b.id, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql`
      SELECT id, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: 'DUPLICATE_BID',
      message: 'BID must be globally unique before activating tags.',
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  // Validate batch status
  const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
  if (!allowedStatuses.includes(batch.status)) {
    return json({
      ok: false,
      reason: 'invalid_batch_state',
      message: `Cannot activate tags while batch status is '${batch.status}'. Batch status must be 'production_registered' or 'active_in_market'.`
    }, 400);
  }

  const target = limit > 0
    ? await sql`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND status = 'inactive'
        ORDER BY created_at ASC, uid_hex ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND status = 'inactive'
        ORDER BY created_at ASC, uid_hex ASC
      `;

  const uids = target.map((row) => String(row.uid_hex || '')).filter(Boolean);
  if (!uids.length) return json({ ok: true, batch: bid, activated: 0, remainingInactive: 0 });

  const updated = await sql`
    UPDATE tags
    SET status = 'active'
    WHERE batch_id = ${batch.id} AND uid_hex = ANY(${uids})
    RETURNING uid_hex
  `;

  const remaining = await sql`
    SELECT COUNT(*)::int AS count
    FROM tags
    WHERE batch_id = ${batch.id} AND status = 'inactive'
  `;

  return json({
    ok: true,
    batch: bid,
    activated: updated.length,
    remainingInactive: Number(remaining[0]?.count || 0),
  });
}
