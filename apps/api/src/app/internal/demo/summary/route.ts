export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { ensureCrmOpsSchema } from '../../../../lib/commercial-runtime-schema';

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  await ensureCrmOpsSchema();

  const tenant = (await sql`SELECT id, slug, name FROM tenants WHERE slug='demobodega' LIMIT 1`)[0];
  if (!tenant) return json({ ok: true, exists: false });
 
  const batch = (await sql`SELECT id, bid, status FROM batches WHERE tenant_id=${tenant.id} AND bid='DEMO-2026-02' LIMIT 1`)[0];
  const tags = await sql`SELECT COUNT(*)::int AS count FROM tags WHERE batch_id=${batch?.id || null}`;
  const leads = await sql`SELECT COUNT(*)::int AS count FROM leads WHERE tenant_id=${tenant.id} OR (tenant_id IS NULL AND LOWER(source)='demo-lab')`;
  const tickets = await sql`SELECT COUNT(*)::int AS count FROM tickets WHERE LOWER(source)='demo-lab'`;
  const orders = await sql`SELECT COUNT(*)::int AS count FROM order_requests WHERE LOWER(source)='demo-lab'`;

  const recentLeads = await sql`
    SELECT id, locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes, assigned_to, created_at 
    FROM leads 
    WHERE tenant_id=${tenant.id} OR (tenant_id IS NULL AND LOWER(source)='demo-lab')
    ORDER BY created_at DESC 
    LIMIT 20
  `;

  const recentTickets = await sql`
    SELECT id, locale, contact, title, detail, status, source, assigned_to, created_at, updated_at 
    FROM tickets 
    WHERE LOWER(source)='demo-lab'
    ORDER BY created_at DESC 
    LIMIT 20
  `;

  const recentOrders = await sql`
    SELECT id, locale, contact, company, tag_type, volume, notes, status, source, assigned_to, created_at, updated_at 
    FROM order_requests 
    WHERE LOWER(source)='demo-lab'
    ORDER BY created_at DESC 
    LIMIT 20
  `;
 
  const events = await sql/*sql*/`
    SELECT
      e.id,
      e.result,
      e.uid_hex,
      e.created_at,
      COALESCE(e.city, e.geo_city) AS city,
      COALESCE(e.country_code, e.geo_country) AS country_code,
      e.lat AS lat,
      e.lng AS lng,
      tp.product_name,
      tp.sku,
      COALESCE(tp.locale_data->>'vertical', 'wine') AS vertical
    FROM events e
    LEFT JOIN tags t ON t.batch_id = e.batch_id AND t.uid_hex = e.uid_hex
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    WHERE e.tenant_id=${tenant.id}
      AND LOWER(COALESCE(e.source, ''))='demo'
    ORDER BY e.created_at DESC
    LIMIT 20
  `;
 
  return json({
    ok: true,
    exists: true,
    tenant,
    batch,
    tagCount: tags[0]?.count || 0,
    crm: { leads: leads[0]?.count || 0, tickets: tickets[0]?.count || 0, orders: orders[0]?.count || 0 },
    recentLeads,
    recentTickets,
    recentOrders,
    events,
  });
}
