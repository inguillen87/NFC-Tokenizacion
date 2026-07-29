export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureConsumerPortalSchema, ensureCrmOpsSchema } from "../../../lib/commercial-runtime-schema";

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

async function ensureOpsSchemas() {
  await ensureCrmOpsSchema();
  await ensureConsumerPortalSchema();
}

async function loadNotificationData() {
  return Promise.all([
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
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  await ensureOpsSchemas();

  let counts: Awaited<ReturnType<typeof loadNotificationData>>[0];
  let latest: Awaited<ReturnType<typeof loadNotificationData>>[1];
  try {
    [counts, latest] = await loadNotificationData();
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureOpsSchemas();
    [counts, latest] = await loadNotificationData();
  }

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
