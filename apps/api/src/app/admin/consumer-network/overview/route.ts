export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { computeConsumerNetworkOverview, resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const requestedTenantSlug = new URL(req.url).searchParams.get("tenant");
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug });

  const rows = await sql/*sql*/`
    WITH tenant_scope AS (
      SELECT id, slug
      FROM tenants
      WHERE (${tenant} = '' OR slug = ${tenant})
    ),
    registered AS (
      SELECT COUNT(DISTINCT h.consumer_id)::int AS cnt
      FROM consumer_tap_history h
      JOIN tenant_scope t ON t.id = h.tenant_id
      WHERE h.consumer_id IS NOT NULL
    ),
    anonymous AS (
      SELECT COUNT(DISTINCT e.uid_hex)::int AS cnt
      FROM events e
      JOIN tenant_scope t ON t.id = e.tenant_id
      WHERE e.uid_hex IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM consumer_tap_history h
          WHERE h.tap_event_id = e.id
            AND h.consumer_id IS NOT NULL
        )
    ),
    members AS (
      SELECT COUNT(DISTINCT m.consumer_id)::int AS cnt
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
    ),
    saved AS (
      SELECT COUNT(*)::int AS cnt
      FROM consumer_products p
      JOIN tenant_scope t ON t.id = p.tenant_id
    ),
    blocked AS (
      SELECT COUNT(*)::int AS cnt
      FROM consumer_product_ownerships o
      JOIN tenant_scope t ON t.id = o.tenant_id
      WHERE o.status IN ('blocked_replay', 'revoked', 'disputed')
    ),
    latest_activity AS (
      SELECT m.consumer_id, c.display_name, t.slug AS tenant_slug, m.last_activity_at
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      LEFT JOIN consumers c ON c.id = m.consumer_id
      ORDER BY m.last_activity_at DESC
      LIMIT 8
    ),
    top_products AS (
      SELECT
        COALESCE(e.product_name, 'Producto NFC') AS product_name,
        COALESCE(b.bid, 'n/a') AS bid,
        COUNT(*)::int AS claims
      FROM consumer_product_ownerships o
      JOIN tenant_scope t ON t.id = o.tenant_id
      LEFT JOIN events e ON e.id = o.event_id
      LEFT JOIN batches b ON b.id = e.batch_id
      WHERE o.status = 'claimed'
      GROUP BY COALESCE(e.product_name, 'Producto NFC'), COALESCE(b.bid, 'n/a')
      ORDER BY claims DESC
      LIMIT 10
    )
    SELECT
      (SELECT cnt FROM anonymous) AS anonymous_tappers,
      (SELECT cnt FROM registered) AS registered_consumers,
      (SELECT cnt FROM members) AS tenant_members,
      (SELECT cnt FROM saved) AS saved_products,
      (SELECT cnt FROM blocked) AS risk_blocked_claims,
      COALESCE((SELECT json_agg(row_to_json(latest_activity)) FROM latest_activity), '[]'::json) AS latest_member_activity,
      COALESCE((SELECT json_agg(row_to_json(top_products)) FROM top_products), '[]'::json) AS top_products_by_claims
  `;
  const row = rows[0] || {};
  const overview = computeConsumerNetworkOverview({
    anonymousTappers: Number(row.anonymous_tappers || 0),
    registeredConsumers: Number(row.registered_consumers || 0),
    tenantMembers: Number(row.tenant_members || 0),
    savedProducts: Number(row.saved_products || 0),
    riskBlockedClaims: Number(row.risk_blocked_claims || 0),
  });

  return json({
    ok: true,
    tenant: tenant || null,
    overview,
    latestMemberActivity: Array.isArray(row.latest_member_activity) ? row.latest_member_activity : [],
    topProductsByClaims: Array.isArray(row.top_products_by_claims) ? row.top_products_by_claims : [],
  });
}
