export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { computeConsumerNetworkOverview, resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
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
    tap_activity AS (
      SELECT
        COUNT(*)::int AS total_taps,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM consumer_tap_history h
            WHERE h.tenant_id = e.tenant_id
              AND h.tap_event_id = e.id
              AND h.consumer_id IS NOT NULL
          )
        )::int AS taps_with_known_actor
      FROM events e
      JOIN tenant_scope t ON t.id = e.tenant_id
    ),
    customer_actions AS (
      SELECT
        COUNT(*)::int AS customer_actions,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM consumer_tap_history h
            WHERE h.tenant_id = a.tenant_id
              AND h.tap_event_id::text = a.data->>'sourceTapEventId'
              AND h.consumer_id IS NOT NULL
          )
        )::int AS actions_with_known_actor
      FROM sdk_external_events a
      JOIN tenant_scope t ON t.id = a.tenant_id
      WHERE a.source = 'public_passport'
    ),
    recognized_units AS (
      SELECT COUNT(DISTINCT NULLIF(BTRIM(e.tag_id::text), ''))::int AS cnt
      FROM events e
      JOIN tenant_scope t ON t.id = e.tenant_id
      WHERE NULLIF(BTRIM(e.tag_id::text), '') IS NOT NULL
    ),
    known_actors AS (
      SELECT COUNT(DISTINCT h.consumer_id)::int AS cnt
      FROM consumer_tap_history h
      JOIN tenant_scope t ON t.id = h.tenant_id
      WHERE h.consumer_id IS NOT NULL
    ),
    verified_identity_actors AS (
      SELECT COUNT(DISTINCT m.consumer_id)::int AS cnt
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      WHERE m.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM consumer_identities identity
          WHERE identity.consumer_id = m.consumer_id
            AND identity.verified_at IS NOT NULL
        )
    ),
    members AS (
      SELECT COUNT(DISTINCT m.consumer_id)::int AS cnt
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      WHERE m.status = 'active'
    ),
    channel_consents AS (
      SELECT
        COUNT(DISTINCT m.consumer_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM consumer_tenant_consents c
            WHERE c.tenant_id = m.tenant_id
              AND c.consumer_id = m.consumer_id
              AND lower(c.scope) = 'email_marketing'
              AND c.granted = true
              AND c.granted_at IS NOT NULL
              AND c.granted_at <= now()
              AND c.revoked_at IS NULL
          )
        )::int AS email,
        COUNT(DISTINCT m.consumer_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM consumer_tenant_consents c
            WHERE c.tenant_id = m.tenant_id
              AND c.consumer_id = m.consumer_id
              AND lower(c.scope) = 'whatsapp_marketing'
              AND c.granted = true
              AND c.granted_at IS NOT NULL
              AND c.granted_at <= now()
              AND c.revoked_at IS NULL
          )
        )::int AS whatsapp,
        COUNT(DISTINCT m.consumer_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM consumer_tenant_consents c
            WHERE c.tenant_id = m.tenant_id
              AND c.consumer_id = m.consumer_id
              AND lower(c.scope) = 'phone_marketing'
              AND c.granted = true
              AND c.granted_at IS NOT NULL
              AND c.granted_at <= now()
              AND c.revoked_at IS NULL
          )
        )::int AS phone
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      WHERE m.status = 'active'
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
    top_products AS (
      SELECT
        COALESCE(e.product_name, 'Producto NFC') AS product_name,
        COALESCE(b.bid, 'n/a') AS bid,
        COUNT(*)::int AS claims
      FROM consumer_product_ownerships o
      JOIN tenant_scope t ON t.id = o.tenant_id
      LEFT JOIN events e ON e.id = o.event_id AND e.tenant_id = o.tenant_id
      LEFT JOIN batches b ON b.id = e.batch_id AND b.tenant_id = o.tenant_id
      WHERE o.status = 'claimed'
      GROUP BY COALESCE(e.product_name, 'Producto NFC'), COALESCE(b.bid, 'n/a')
      ORDER BY claims DESC
      LIMIT 10
    )
    SELECT
      (SELECT total_taps FROM tap_activity) AS total_taps,
      (SELECT taps_with_known_actor FROM tap_activity) AS taps_with_known_actor,
      (SELECT customer_actions FROM customer_actions) AS customer_actions,
      (SELECT actions_with_known_actor FROM customer_actions) AS actions_with_known_actor,
      (SELECT cnt FROM recognized_units) AS recognized_units,
      (SELECT cnt FROM known_actors) AS known_actors,
      (SELECT cnt FROM verified_identity_actors) AS verified_identity_actors,
      (SELECT cnt FROM members) AS active_tenant_members,
      (SELECT email FROM channel_consents) AS consented_email_actors,
      (SELECT whatsapp FROM channel_consents) AS consented_whatsapp_actors,
      (SELECT phone FROM channel_consents) AS consented_phone_actors,
      (SELECT cnt FROM saved) AS saved_products,
      (SELECT cnt FROM blocked) AS risk_blocked_claims,
      COALESCE((SELECT json_agg(row_to_json(top_products)) FROM top_products), '[]'::json) AS top_products_by_claims
  `;
  const row = rows[0] || {};
  const overview = computeConsumerNetworkOverview({
    totalTaps: Number(row.total_taps || 0),
    customerActions: Number(row.customer_actions || 0),
    tapsWithKnownActor: Number(row.taps_with_known_actor || 0),
    actionsWithKnownActor: Number(row.actions_with_known_actor || 0),
    recognizedUnits: Number(row.recognized_units || 0),
    knownActors: Number(row.known_actors || 0),
    verifiedIdentityActors: Number(row.verified_identity_actors || 0),
    activeTenantMembers: Number(row.active_tenant_members || 0),
    consentedEmailActors: Number(row.consented_email_actors || 0),
    consentedWhatsappActors: Number(row.consented_whatsapp_actors || 0),
    consentedPhoneActors: Number(row.consented_phone_actors || 0),
    savedProducts: Number(row.saved_products || 0),
    riskBlockedClaims: Number(row.risk_blocked_claims || 0),
  });

  return json({
    ok: true,
    tenant: tenant || null,
    overview,
    identityBoundary: "Los UID, tags, direcciones IP y dispositivos identifican actividad o unidades; no se interpretan como personas.",
    topProductsByClaims: Array.isArray(row.top_products_by_claims) ? row.top_products_by_claims : [],
  }, 200, NO_STORE);
}
