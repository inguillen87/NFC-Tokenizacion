export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ackBy = String(body.acknowledged_by || "admin");
  const rows = await sql/*sql*/`
    UPDATE security_alerts
    SET status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = ${ackBy},
        updated_at = now()
    WHERE id = ${id}
      AND (
        ${forcedTenantSlug} = ''
        OR tenant_id = (SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1)
      )
    RETURNING *
  `;
  if (!rows[0]) return json({ ok: false, error: "not_found" }, 404);
  return json({ ok: true, item: rows[0] });
}
