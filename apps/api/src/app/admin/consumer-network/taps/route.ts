export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";
import { consumerNetworkProvenanceFromRow, withConsumerNetworkEventProvenance } from "../../../../lib/consumer-network-provenance";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });

  const read = withConsumerNetworkEventProvenance(sql, { event: "e", batch: "provenance_batch", tag: "provenance_tag" });
  const rows = await read/*sql*/`
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
        /* consumer-network-event-provenance */ AS data_provenance
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
        CASE
          WHEN COUNT(*) = 1 THEN MIN(data_provenance)
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM event_evidence_candidates
      GROUP BY tenant_id, id
    ),
    tap_rows AS (
    SELECT
      h.tap_event_id,
      h.verdict,
      h.risk_level,
      h.city,
      h.country,
      h.created_at,
      t.slug AS tenant_slug,
      COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance,
      e.created_at AS provenance_event_created_at
    FROM consumer_tap_history h
    JOIN tenant_scope t ON t.id = h.tenant_id
    LEFT JOIN event_evidence e ON e.id = h.tap_event_id AND e.tenant_id = h.tenant_id
    )
    SELECT
      tap_rows.*,
      (COUNT(*) FILTER (WHERE data_provenance = 'operational_tap') OVER ())::int AS provenance_operational_tap,
      (COUNT(*) FILTER (WHERE data_provenance = 'declared_demo') OVER ())::int AS provenance_declared_demo,
      (COUNT(*) FILTER (WHERE data_provenance = 'imported') OVER ())::int AS provenance_imported,
      (COUNT(*) FILTER (WHERE data_provenance = 'legacy_unclassified') OVER ())::int AS provenance_legacy_unclassified,
      0::int AS provenance_mixed,
      MAX(provenance_event_created_at) FILTER (WHERE data_provenance = 'operational_tap') OVER () AS latest_operational_at
    FROM tap_rows
    ORDER BY created_at DESC
    LIMIT 200
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
      provenance_event_created_at: _provenanceEventCreatedAt,
      ...item
    } = row;
    return item;
  });
  return json({ ok: true, tenant: tenant || null, provenance, items }, 200, NO_STORE);
}
