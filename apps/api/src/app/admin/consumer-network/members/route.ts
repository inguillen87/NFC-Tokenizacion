export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { maskConsumerEmail, resolveConsumerNetworkTenant, segmentConsumerNetworkMember } from "../../../../lib/consumer-network-metrics";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

function maskConsumerPhone(phone: string | null | undefined) {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 7) return "***";
  return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "consumers.read_pii");
  if (auth) return auth;
  await ensureConsumerPortalSchema();
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });
  const rows = await sql/*sql*/`
    WITH member_base AS (
      SELECT
        m.tenant_id,
        m.consumer_id,
        c.display_name,
        c.email,
        c.phone,
        m.status,
        m.points_balance,
        m.lifetime_points,
        m.joined_at,
        m.last_activity_at,
        t.slug AS tenant_slug
      FROM tenant_consumer_memberships m
      JOIN tenants t ON t.id = m.tenant_id
      JOIN consumers c ON c.id = m.consumer_id
      WHERE (${tenant} = '' OR t.slug = ${tenant})
    ),
    tap_stats AS (
      SELECT
        h.consumer_id,
        h.tenant_id,
        COUNT(*)::int AS tap_count,
        COUNT(*) FILTER (WHERE upper(COALESCE(h.verdict, '')) IN ('VALID', 'OK', 'TAP_VALID'))::int AS valid_taps,
        COUNT(*) FILTER (
          WHERE upper(COALESCE(h.verdict, '')) IN (
            'REPLAY_SUSPECT', 'BLOCKED_REPLAY', 'DUPLICATE',
            'TAMPER', 'TAMPERED', 'TAMPER_RISK',
            'INVALID', 'TAP_INVALID', 'REVOKED', 'BROKEN'
          )
             OR lower(COALESCE(h.risk_level, '')) IN ('medium', 'high', 'critical')
        )::int AS risk_taps,
        MAX(h.created_at) AS last_tap_at,
        (array_agg(NULLIF(h.city, '') ORDER BY h.created_at DESC) FILTER (WHERE NULLIF(h.city, '') IS NOT NULL))[1] AS city,
        (array_agg(NULLIF(h.country, '') ORDER BY h.created_at DESC) FILTER (WHERE NULLIF(h.country, '') IS NOT NULL))[1] AS country
      FROM consumer_tap_history h
      GROUP BY h.consumer_id, h.tenant_id
    ),
    product_stats AS (
      SELECT
        cp.consumer_id,
        cp.tenant_id,
        COUNT(*)::int AS saved_products,
        (array_agg(NULLIF(cp.product_name, '') ORDER BY cp.updated_at DESC) FILTER (WHERE NULLIF(cp.product_name, '') IS NOT NULL))[1] AS last_product
      FROM consumer_products cp
      GROUP BY cp.consumer_id, cp.tenant_id
    ),
    consent_stats AS (
      SELECT
        tenant_id,
        consumer_id,
        bool_or(granted AND scope IN ('marketing', 'campaigns', 'promotions', 'whatsapp_marketing')) AS marketing_opt_in,
        bool_or(granted AND scope IN ('whatsapp', 'whatsapp_marketing', 'phone_marketing')) AS whatsapp_opt_in,
        MAX(granted_at) FILTER (WHERE granted) AS latest_consent_at
      FROM consumer_tenant_consents
      GROUP BY tenant_id, consumer_id
    )
    SELECT
      mb.consumer_id,
      mb.display_name,
      mb.email,
      mb.phone,
      mb.status,
      mb.points_balance,
      mb.lifetime_points,
      mb.joined_at,
      mb.last_activity_at,
      mb.tenant_slug,
      COALESCE(ts.tap_count, 0)::int AS tap_count,
      COALESCE(ts.valid_taps, 0)::int AS valid_taps,
      COALESCE(ts.risk_taps, 0)::int AS risk_taps,
      ts.last_tap_at,
      ts.city,
      ts.country,
      COALESCE(ps.saved_products, 0)::int AS saved_products,
      ps.last_product,
      COALESCE(cs.marketing_opt_in, false) AS marketing_opt_in,
      COALESCE(cs.whatsapp_opt_in, false) AS whatsapp_opt_in,
      cs.latest_consent_at
    FROM member_base mb
    LEFT JOIN tap_stats ts ON ts.consumer_id = mb.consumer_id AND ts.tenant_id = mb.tenant_id
    LEFT JOIN product_stats ps ON ps.consumer_id = mb.consumer_id AND ps.tenant_id = mb.tenant_id
    LEFT JOIN consent_stats cs ON cs.consumer_id = mb.consumer_id AND cs.tenant_id = mb.tenant_id
    ORDER BY mb.last_activity_at DESC
    LIMIT 500
  `;
  const items = rows.map((row) => ({
    ...row,
    email: undefined,
    email_masked: maskConsumerEmail(row.email as string | null | undefined),
    phone: undefined,
    phone_masked: maskConsumerPhone(row.phone as string | null | undefined),
    segment: segmentConsumerNetworkMember(row as Record<string, unknown>),
  }));
  return json({ ok: true, tenant: tenant || null, items }, 200, NO_STORE);
}
