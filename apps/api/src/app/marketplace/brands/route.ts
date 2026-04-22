export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET() {
  const rows = await sql/*sql*/`
    SELECT mb.*, t.name AS tenant_name
    FROM marketplace_brand_profiles mb
    JOIN tenants t ON t.id = mb.tenant_id
    WHERE mb.visible_in_network = true AND mb.status = 'active'
    ORDER BY mb.featured DESC, mb.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
