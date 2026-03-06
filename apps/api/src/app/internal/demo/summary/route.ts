export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const tenant = (await sql`SELECT id, slug, name FROM tenants WHERE slug='demobodega' LIMIT 1`)[0];
  if (!tenant) return json({ ok: true, exists: false });

  const batch = (await sql`SELECT id, bid, status FROM batches WHERE tenant_id=${tenant.id} AND bid='DEMO-2026-02' LIMIT 1`)[0];
  const tags = await sql`SELECT COUNT(*)::int AS count FROM tags WHERE batch_id=${batch?.id || null}`;
  const events = await sql`SELECT id, result, uid_hex, created_at FROM events WHERE tenant_id=${tenant.id} ORDER BY created_at DESC LIMIT 12`;
  const leads = await sql`SELECT COUNT(*)::int AS count FROM leads`;
  const tickets = await sql`SELECT COUNT(*)::int AS count FROM tickets`;
  const orders = await sql`SELECT COUNT(*)::int AS count FROM order_requests`;

  return json({
    ok: true,
    exists: true,
    tenant,
    batch,
    tagCount: tags[0]?.count || 0,
    crm: { leads: leads[0]?.count || 0, tickets: tickets[0]?.count || 0, orders: orders[0]?.count || 0 },
    events,
  });
}
