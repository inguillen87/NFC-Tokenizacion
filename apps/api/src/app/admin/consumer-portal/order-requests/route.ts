export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const tenant = new URL(req.url).searchParams.get('tenant') || '';
  if (!tenant) return json({ ok: false, error: 'tenant_required' }, 400);
  const rows = await sql/*sql*/`
    SELECT o.*, c.email, c.phone, p.title AS product_title
    FROM tenants t
    JOIN marketplace_order_requests o ON o.tenant_id = t.id
    JOIN consumers c ON c.id = o.consumer_id
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    WHERE t.slug = ${tenant}
    ORDER BY o.created_at DESC
    LIMIT 500
  `;
  return json({ ok: true, items: rows });
}
