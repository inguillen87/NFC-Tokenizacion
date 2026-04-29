export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

function normalizeTenantSlug(input: string) {
  return String(input || "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vertical = url.searchParams.get("vertical");
  const tenant = normalizeTenantSlug(url.searchParams.get("tenant") || "");

  const rows = vertical
    ? await sql/*sql*/`
      SELECT p.*, t.slug AS tenant_slug, mb.display_name AS brand_name, mb.slug AS brand_slug
      FROM marketplace_products p
      JOIN tenants t ON t.id = p.tenant_id
      JOIN marketplace_brand_profiles mb ON mb.tenant_id = p.tenant_id
      WHERE p.status = 'active'
        AND p.vertical = ${vertical}
        AND mb.status = 'active'
        AND mb.visible_in_network = true
        AND (${tenant} = '' OR t.slug = ${tenant})
      ORDER BY p.featured DESC, p.updated_at DESC
    `
    : await sql/*sql*/`
      SELECT p.*, t.slug AS tenant_slug, mb.display_name AS brand_name, mb.slug AS brand_slug
      FROM marketplace_products p
      JOIN tenants t ON t.id = p.tenant_id
      JOIN marketplace_brand_profiles mb ON mb.tenant_id = p.tenant_id
      WHERE p.status = 'active'
        AND mb.status = 'active'
        AND mb.visible_in_network = true
        AND (${tenant} = '' OR t.slug = ${tenant})
      ORDER BY p.featured DESC, p.updated_at DESC
    `;

  return json({ ok: true, items: rows });
}
