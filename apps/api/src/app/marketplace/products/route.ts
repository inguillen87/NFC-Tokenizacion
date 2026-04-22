export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vertical = url.searchParams.get('vertical');
  const rows = vertical ? await sql/*sql*/`
    SELECT p.*, t.slug AS tenant_slug
    FROM marketplace_products p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.status = 'active' AND p.vertical = ${vertical}
    ORDER BY p.featured DESC, p.updated_at DESC
  ` : await sql/*sql*/`
    SELECT p.*, t.slug AS tenant_slug
    FROM marketplace_products p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.status = 'active'
    ORDER BY p.featured DESC, p.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
