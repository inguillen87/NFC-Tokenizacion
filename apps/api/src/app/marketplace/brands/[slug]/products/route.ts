export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureConsumerPortalSchema();
  const { slug } = await params;
  const brandSlug = String(slug || "").trim().toLowerCase();
  if (!brandSlug) return json({ ok: false, error: "brand_required" }, 400);

  const rows = await sql/*sql*/`
    SELECT p.*, t.slug AS tenant_slug, mb.display_name AS brand_name, mb.slug AS brand_slug
    FROM marketplace_products p
    JOIN tenants t ON t.id = p.tenant_id
    JOIN marketplace_brand_profiles mb ON mb.tenant_id = p.tenant_id
    WHERE mb.slug = ${brandSlug}
      AND mb.status = 'active'
      AND mb.visible_in_network = true
      AND p.status = 'active'
    ORDER BY p.featured DESC, p.updated_at DESC
  `;

  return json({ ok: true, items: rows });
}
