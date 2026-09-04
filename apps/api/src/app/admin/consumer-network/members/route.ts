export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { maskConsumerEmail, resolveConsumerNetworkTenant, segmentConsumerNetworkMember } from "../../../../lib/consumer-network-metrics";
import { consumerNetworkProvenanceFromRow } from "../../../../lib/consumer-network-provenance";

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
    WITH tenant_scope AS (
      SELECT id, slug
      FROM tenants
      WHERE (${tenant} = '' OR slug = ${tenant})
    ),
    event_evidence_candidates AS (
      SELECT
        e.id,
        e.tenant_id,
        e.created_at,
        e.tag_id,
        e.uid_hex,
        CASE
          WHEN LOWER(COALESCE(e.source::text, '')) = 'demo'
            OR LOWER(COALESCE(e.meta->>'event_mode', '')) IN ('demo', 'simulated')
            OR LOWER(COALESCE(e.meta->>'replay_execution_class', '')) = 'demo'
            OR LOWER(COALESCE(e.meta->>'simulated', '')) = 'true'
            OR LOWER(COALESCE(e.meta->>'demoEmitter', '')) = 'true'
            OR (
              LOWER(COALESCE(e.meta->>'seed', '')) = 'true'
              AND LOWER(COALESCE(e.meta->>'corpus', '')) LIKE 'demo%'
            )
          THEN 'declared_demo'
          WHEN LOWER(COALESCE(e.source::text, '')) = 'imported' THEN 'imported'
          WHEN LOWER(COALESCE(e.source::text, '')) = 'real'
            AND e.event_type::text IN ('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT')
            AND provenance_batch.id IS NOT NULL
            AND provenance_tag.id IS NOT NULL
            AND (
              LOWER(COALESCE(e.meta->>'replay_execution_class', '')) = 'operational'
              OR (
                EXISTS (
                  SELECT 1
                  FROM canonical_event_operations canonical_operation
                  WHERE canonical_operation.tenant_id = e.tenant_id
                    AND canonical_operation.event_id = e.id
                    AND canonical_operation.event_created_at = e.created_at
                    AND canonical_operation.event_mode = 'live'
                )
                AND
                LOWER(COALESCE(e.meta->>'canonical_event', '')) = 'true'
                AND LOWER(COALESCE(e.meta->>'event_family', '')) = 'tap'
                AND LOWER(COALESCE(e.meta->>'event_mode', '')) = 'live'
                AND LOWER(COALESCE(e.meta->>'metric_scope', '')) = 'scan'
                AND LOWER(COALESCE(e.meta->>'simulated', '')) = 'false'
              )
            )
          THEN 'operational_tap'
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM events e
      JOIN tenant_scope scope ON scope.id = e.tenant_id
      LEFT JOIN batches provenance_batch
        ON provenance_batch.id = e.batch_id
       AND provenance_batch.tenant_id = e.tenant_id
      LEFT JOIN tags provenance_tag
        ON provenance_tag.id::text = e.tag_id::text
       AND provenance_tag.batch_id = e.batch_id
       AND UPPER(provenance_tag.uid_hex) = UPPER(e.uid_hex)
      WHERE e.event_type::text IN ('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT')
    ),
    event_evidence AS (
      SELECT
        tenant_id,
        id,
        MIN(created_at) AS created_at,
        CASE WHEN COUNT(*) = 1 THEN MIN(tag_id::text) ELSE NULL END AS tag_id,
        CASE WHEN COUNT(*) = 1 THEN MIN(uid_hex) ELSE NULL END AS uid_hex,
        CASE
          WHEN COUNT(*) = 1 THEN MIN(data_provenance)
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM event_evidence_candidates
      GROUP BY tenant_id, id
    ),
    member_base AS (
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
        m.source AS membership_source,
        m.first_tap_event_id,
        m.last_tap_event_id,
        t.slug AS tenant_slug
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      JOIN consumers c ON c.id = m.consumer_id
    ),
    member_evidence AS (
      SELECT h.tenant_id, h.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance, e.created_at AS event_created_at
      FROM consumer_tap_history h
      JOIN member_base mb ON mb.tenant_id = h.tenant_id AND mb.consumer_id = h.consumer_id
      LEFT JOIN event_evidence e ON e.tenant_id = h.tenant_id AND e.id = h.tap_event_id
      UNION ALL
      SELECT mb.tenant_id, mb.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance, e.created_at AS event_created_at
      FROM member_base mb
      LEFT JOIN event_evidence e ON e.tenant_id = mb.tenant_id AND e.id = mb.first_tap_event_id
      WHERE mb.first_tap_event_id IS NOT NULL
      UNION ALL
      SELECT mb.tenant_id, mb.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance, e.created_at AS event_created_at
      FROM member_base mb
      LEFT JOIN event_evidence e ON e.tenant_id = mb.tenant_id AND e.id = mb.last_tap_event_id
      WHERE mb.last_tap_event_id IS NOT NULL
        AND mb.last_tap_event_id IS DISTINCT FROM mb.first_tap_event_id
      UNION ALL
      SELECT mb.tenant_id, mb.consumer_id, 'declared_demo' AS data_provenance, NULL::timestamptz AS event_created_at
      FROM member_base mb
      WHERE LOWER(COALESCE(mb.membership_source, '')) = 'demo_login'
    ),
    member_provenance AS (
      SELECT
        mb.tenant_id,
        mb.consumer_id,
        CASE
          WHEN COUNT(DISTINCT evidence.data_provenance) FILTER (WHERE evidence.data_provenance IS NOT NULL) > 1 THEN 'mixed'
          WHEN BOOL_OR(evidence.data_provenance = 'operational_tap') THEN 'operational_tap'
          WHEN BOOL_OR(evidence.data_provenance = 'declared_demo') THEN 'declared_demo'
          WHEN BOOL_OR(evidence.data_provenance = 'imported') THEN 'imported'
          ELSE 'legacy_unclassified'
        END AS data_provenance,
        MAX(evidence.event_created_at) FILTER (
          WHERE evidence.data_provenance = 'operational_tap'
        ) AS latest_operational_at
      FROM member_base mb
      LEFT JOIN member_evidence evidence
        ON evidence.tenant_id = mb.tenant_id
       AND evidence.consumer_id = mb.consumer_id
      GROUP BY mb.tenant_id, mb.consumer_id
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
      JOIN event_evidence e ON e.tenant_id = h.tenant_id AND e.id = h.tap_event_id
      WHERE e.data_provenance = 'operational_tap'
      GROUP BY h.consumer_id, h.tenant_id
    ),
    product_base AS (
      SELECT cp.*
      FROM consumer_products cp
      JOIN tenant_scope scope ON scope.id = cp.tenant_id
    ),
    product_event_references AS (
      SELECT
        cp.id AS product_id,
        cp.tenant_id,
        history.tap_event_id AS event_id
      FROM product_base cp
      JOIN consumer_tap_history history
        ON history.tenant_id = cp.tenant_id
       AND history.consumer_id = cp.consumer_id
      JOIN event_evidence linked_event
        ON linked_event.tenant_id = history.tenant_id
       AND linked_event.id = history.tap_event_id
      WHERE (
        cp.tag_id IS NOT NULL
        AND linked_event.tag_id::text = cp.tag_id::text
      ) OR (
        NULLIF(BTRIM(cp.product_passport_id), '') IS NOT NULL
        AND UPPER(linked_event.uid_hex) = UPPER(cp.product_passport_id)
      )
      UNION
      SELECT
        cp.id AS product_id,
        cp.tenant_id,
        event_ref.event_id
      FROM product_base cp
      CROSS JOIN LATERAL (
        VALUES (cp.first_tap_event_id), (cp.latest_tap_event_id)
      ) AS event_ref(event_id)
      WHERE event_ref.event_id IS NOT NULL
    ),
    product_event_evidence AS (
      SELECT
        reference.product_id,
        COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM product_event_references reference
      LEFT JOIN event_evidence e
        ON e.tenant_id = reference.tenant_id
       AND e.id = reference.event_id
    ),
    product_provenance AS (
      SELECT
        cp.id AS product_id,
        CASE
          WHEN COUNT(DISTINCT evidence.data_provenance) FILTER (WHERE evidence.data_provenance IS NOT NULL) > 1 THEN 'mixed'
          WHEN BOOL_OR(evidence.data_provenance = 'operational_tap') THEN 'operational_tap'
          WHEN BOOL_OR(evidence.data_provenance = 'declared_demo') THEN 'declared_demo'
          WHEN BOOL_OR(evidence.data_provenance = 'imported') THEN 'imported'
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM product_base cp
      LEFT JOIN product_event_evidence evidence ON evidence.product_id = cp.id
      GROUP BY cp.id
    ),
    product_stats AS (
      SELECT
        cp.consumer_id,
        cp.tenant_id,
        COUNT(*)::int AS saved_products,
        (array_agg(NULLIF(cp.product_name, '') ORDER BY cp.updated_at DESC) FILTER (WHERE NULLIF(cp.product_name, '') IS NOT NULL))[1] AS last_product
      FROM product_base cp
      JOIN product_provenance provenance ON provenance.product_id = cp.id
      WHERE provenance.data_provenance = 'operational_tap'
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
      cs.latest_consent_at,
      mp.data_provenance,
      (COUNT(*) FILTER (WHERE mp.data_provenance = 'operational_tap') OVER ())::int AS provenance_operational_tap,
      (COUNT(*) FILTER (WHERE mp.data_provenance = 'declared_demo') OVER ())::int AS provenance_declared_demo,
      (COUNT(*) FILTER (WHERE mp.data_provenance = 'imported') OVER ())::int AS provenance_imported,
      (COUNT(*) FILTER (WHERE mp.data_provenance = 'legacy_unclassified') OVER ())::int AS provenance_legacy_unclassified,
      (COUNT(*) FILTER (WHERE mp.data_provenance = 'mixed') OVER ())::int AS provenance_mixed,
      MAX(mp.latest_operational_at) FILTER (WHERE mp.data_provenance = 'operational_tap') OVER () AS latest_operational_at
    FROM member_base mb
    JOIN member_provenance mp ON mp.tenant_id = mb.tenant_id AND mp.consumer_id = mb.consumer_id
    LEFT JOIN tap_stats ts ON ts.consumer_id = mb.consumer_id AND ts.tenant_id = mb.tenant_id
    LEFT JOIN product_stats ps ON ps.consumer_id = mb.consumer_id AND ps.tenant_id = mb.tenant_id
    LEFT JOIN consent_stats cs ON cs.consumer_id = mb.consumer_id AND cs.tenant_id = mb.tenant_id
    ORDER BY mb.last_activity_at DESC
    LIMIT 500
  `;
  const provenance = consumerNetworkProvenanceFromRow(rows[0] as Record<string, unknown> | undefined);
  const items = rows.map((row) => {
    const {
      provenance_operational_tap: _operational,
      provenance_declared_demo: _demo,
      provenance_imported: _imported,
      provenance_legacy_unclassified: _legacy,
      provenance_mixed: _mixed,
      latest_operational_at: _latestOperational,
      ...item
    } = row;
    return {
      ...item,
      email: undefined,
      email_masked: maskConsumerEmail(row.email as string | null | undefined),
      phone: undefined,
      phone_masked: maskConsumerPhone(row.phone as string | null | undefined),
      segment: segmentConsumerNetworkMember(row as Record<string, unknown>),
    };
  });
  return json({ ok: true, tenant: tenant || null, provenance, items }, 200, NO_STORE);
}
