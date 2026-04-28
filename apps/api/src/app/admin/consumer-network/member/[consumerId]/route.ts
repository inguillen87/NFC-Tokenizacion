export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { maskConsumerEmail, resolveConsumerNetworkTenant } from "../../../../../lib/consumer-network-metrics";

export async function GET(req: Request, { params }: { params: Promise<{ consumerId: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });
  const { consumerId } = await params;

  const consumerRows = await sql/*sql*/`
    SELECT c.id, c.display_name, c.email
    FROM consumers c
    WHERE c.id = ${consumerId}
      AND EXISTS (
        SELECT 1
        FROM tenant_consumer_memberships m
        JOIN tenants t ON t.id = m.tenant_id
        WHERE m.consumer_id = c.id
          AND (${tenant} = '' OR t.slug = ${tenant})
      )
    LIMIT 1
  `;
  const consumer = consumerRows[0];
  if (!consumer) return json({ ok: false, error: "not_found" }, 404);

  const [memberships, products, taps] = await Promise.all([
    sql/*sql*/`
      SELECT m.status, m.points_balance, m.lifetime_points, m.joined_at, m.last_activity_at, t.slug AS tenant_slug
      FROM tenant_consumer_memberships m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE m.consumer_id = ${consumerId}
        AND (${tenant} = '' OR t.slug = ${tenant})
      ORDER BY m.last_activity_at DESC
    `,
    sql/*sql*/`
      SELECT cp.product_name, cp.ownership_status, cp.created_at, t.slug AS tenant_slug
      FROM consumer_products cp
      JOIN tenants t ON t.id = cp.tenant_id
      WHERE cp.consumer_id = ${consumerId}
        AND (${tenant} = '' OR t.slug = ${tenant})
      ORDER BY cp.updated_at DESC
      LIMIT 50
    `,
    sql/*sql*/`
      SELECT h.tap_event_id, h.verdict, h.risk_level, h.city, h.country, h.created_at, t.slug AS tenant_slug
      FROM consumer_tap_history h
      JOIN tenants t ON t.id = h.tenant_id
      WHERE h.consumer_id = ${consumerId}
        AND (${tenant} = '' OR t.slug = ${tenant})
      ORDER BY h.created_at DESC
      LIMIT 100
    `,
  ]);

  return json({
    ok: true,
    tenant: tenant || null,
    consumer: {
      id: consumer.id,
      display_name: consumer.display_name,
      email_masked: maskConsumerEmail(consumer.email as string | null | undefined),
    },
    memberships,
    products,
    taps,
  });
}
