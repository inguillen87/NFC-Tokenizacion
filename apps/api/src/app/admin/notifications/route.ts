export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureConsumerPortalSchema, ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await Promise.all([ensureCrmOpsSchema(), ensureConsumerPortalSchema()]);

  const [counts, latest] = await Promise.all([
    sql/*sql*/`
      SELECT
        (SELECT count(*)::int FROM leads WHERE status = 'new') AS new_leads,
        (SELECT count(*)::int FROM tickets WHERE status = 'open') AS open_tickets,
        (
          (SELECT count(*)::int FROM order_requests WHERE status = 'new') +
          (SELECT count(*)::int FROM marketplace_order_requests WHERE status = 'requested')
        ) AS new_orders
    `,
    sql/*sql*/`
      SELECT 'lead' AS type, id::text, contact, company AS title, status, created_at
      FROM leads
      WHERE status = 'new'
      UNION ALL
      SELECT 'ticket' AS type, id::text, contact, title, status, created_at
      FROM tickets
      WHERE status = 'open'
      UNION ALL
      SELECT 'order' AS type, id::text, contact, company AS title, status, created_at
      FROM order_requests
      WHERE status = 'new'
      UNION ALL
      SELECT
        'order' AS type,
        mor.id::text,
        COALESCE(c.email, c.phone, 'consumer:' || c.id::text) AS contact,
        COALESCE(p.title, mb.display_name, 'Marketplace request') AS title,
        mor.status,
        mor.created_at
      FROM marketplace_order_requests mor
      JOIN consumers c ON c.id = mor.consumer_id
      LEFT JOIN marketplace_products p ON p.id = mor.marketplace_product_id
      LEFT JOIN marketplace_brand_profiles mb ON mb.tenant_id = mor.tenant_id
      WHERE mor.status = 'requested'
      ORDER BY created_at DESC
      LIMIT 8
    `,
  ]);

  const summary = counts[0] as Record<string, number>;
  const unreadCount = Number(summary.new_leads || 0) + Number(summary.open_tickets || 0) + Number(summary.new_orders || 0);

  return json({
    ok: true,
    unreadCount,
    counts: summary,
    latest,
    generatedAt: new Date().toISOString(),
  });
}
