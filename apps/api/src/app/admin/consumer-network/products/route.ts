export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";
import { consumerNetworkProvenanceFromRow } from "../../../../lib/consumer-network-provenance";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;
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
        e.product_name,
        e.batch_id,
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
        CASE WHEN COUNT(*) = 1 THEN MIN(product_name) ELSE NULL END AS product_name,
        CASE WHEN COUNT(*) = 1 THEN MIN(batch_id::text)::uuid ELSE NULL END AS batch_id,
        CASE
          WHEN COUNT(*) = 1 THEN MIN(data_provenance)
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM event_evidence_candidates
      GROUP BY tenant_id, id
    ),
    product_base AS (
      SELECT cp.*, scope.slug AS tenant_slug
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
        COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance,
        e.created_at AS event_created_at
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
        END AS data_provenance,
        MAX(evidence.event_created_at) FILTER (
          WHERE evidence.data_provenance = 'operational_tap'
        ) AS latest_operational_at
      FROM product_base cp
      LEFT JOIN product_event_evidence evidence ON evidence.product_id = cp.id
      GROUP BY cp.id
    ),
    product_rows AS (
      SELECT
        COALESCE(e.product_name, cp.product_name, 'Producto NFC') AS product_name,
        cp.tenant_slug,
        COALESCE(b.bid, 'n/a') AS bid,
        provenance.data_provenance,
        COUNT(*)::int AS saved_count,
        COUNT(*) FILTER (WHERE cp.ownership_status = 'claimed')::int AS claimed_count,
        MAX(cp.updated_at) AS latest_activity_at,
        MAX(provenance.latest_operational_at) AS provenance_latest_operational_at
      FROM product_base cp
      JOIN product_provenance provenance ON provenance.product_id = cp.id
      LEFT JOIN event_evidence e ON e.id = cp.latest_tap_event_id AND e.tenant_id = cp.tenant_id
      LEFT JOIN batches b ON b.id = e.batch_id AND b.tenant_id = cp.tenant_id
      GROUP BY COALESCE(e.product_name, cp.product_name, 'Producto NFC'), cp.tenant_slug, COALESCE(b.bid, 'n/a'), provenance.data_provenance
    )
    SELECT
      product_rows.*,
      (COALESCE(SUM(saved_count) FILTER (WHERE data_provenance = 'operational_tap') OVER (), 0))::int AS provenance_operational_tap,
      (COALESCE(SUM(saved_count) FILTER (WHERE data_provenance = 'declared_demo') OVER (), 0))::int AS provenance_declared_demo,
      (COALESCE(SUM(saved_count) FILTER (WHERE data_provenance = 'imported') OVER (), 0))::int AS provenance_imported,
      (COALESCE(SUM(saved_count) FILTER (WHERE data_provenance = 'legacy_unclassified') OVER (), 0))::int AS provenance_legacy_unclassified,
      (COALESCE(SUM(saved_count) FILTER (WHERE data_provenance = 'mixed') OVER (), 0))::int AS provenance_mixed,
      MAX(provenance_latest_operational_at) FILTER (WHERE data_provenance = 'operational_tap') OVER () AS latest_operational_at
    FROM product_rows
    ORDER BY claimed_count DESC, saved_count DESC
    LIMIT 100
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
      provenance_latest_operational_at: _itemLatestOperational,
      ...item
    } = row;
    return item;
  });
  return json({ ok: true, tenant: tenant || null, provenance, items }, 200, NO_STORE);
}
