export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../../lib/db";
import { checkAdminWithPermission, getAdminTenantAccess } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdminWithPermission(req, "batch.revoke");
  if (auth) return auth;

  const { bid } = await params;
  const { forcedTenantSlug } = getAdminTenantAccess(req);
  const batches = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (!batches[0]) return json({ ok: false, reason: "batch not found" }, 404);
  if (batches.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before revoking a batch.",
      batches: batches.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const rows = await sql/*sql*/`
    UPDATE batches
    SET status = 'revoked'
    WHERE id = ${batches[0].id}
    RETURNING id, bid, status
  `;

  return json({ ok: true, batch: rows[0] });
}
