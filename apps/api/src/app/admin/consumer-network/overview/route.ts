export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { computeConsumerNetworkOverview, resolveConsumerNetworkTenant } from "../../../../lib/consumer-network-metrics";
import {
  consumerNetworkProvenanceFromRow,
  withConsumerNetworkEventProvenance,
  readConsumerNetworkAggregateCount,
} from "../../../../lib/consumer-network-provenance";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const requestedTenantSlug = new URL(req.url).searchParams.get("tenant");
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug });

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
        e.tag_id,
        e.uid_hex,
        e.product_name,
        e.batch_id,
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
    consumer_event_evidence AS (
      SELECT tenant_id, id, created_at, tag_id, uid_hex, product_name, batch_id, data_provenance
      FROM event_evidence
    ),
    actor_keys AS (
      SELECT h.tenant_id, h.consumer_id
      FROM consumer_tap_history h
      JOIN tenant_scope scope ON scope.id = h.tenant_id
      WHERE h.consumer_id IS NOT NULL
      UNION
      SELECT m.tenant_id, m.consumer_id
      FROM tenant_consumer_memberships m
      JOIN tenant_scope scope ON scope.id = m.tenant_id
    ),
    actor_event_evidence AS (
      SELECT h.tenant_id, h.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM consumer_tap_history h
      JOIN actor_keys actor ON actor.tenant_id = h.tenant_id AND actor.consumer_id = h.consumer_id
      LEFT JOIN consumer_event_evidence e ON e.tenant_id = h.tenant_id AND e.id = h.tap_event_id
      WHERE h.consumer_id IS NOT NULL
      UNION ALL
      SELECT m.tenant_id, m.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM tenant_consumer_memberships m
      JOIN tenant_scope scope ON scope.id = m.tenant_id
      LEFT JOIN consumer_event_evidence e ON e.tenant_id = m.tenant_id AND e.id = m.first_tap_event_id
      WHERE m.first_tap_event_id IS NOT NULL
      UNION ALL
      SELECT m.tenant_id, m.consumer_id, COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM tenant_consumer_memberships m
      JOIN tenant_scope scope ON scope.id = m.tenant_id
      LEFT JOIN consumer_event_evidence e ON e.tenant_id = m.tenant_id AND e.id = m.last_tap_event_id
      WHERE m.last_tap_event_id IS NOT NULL
        AND m.last_tap_event_id IS DISTINCT FROM m.first_tap_event_id
      UNION ALL
      SELECT m.tenant_id, m.consumer_id, 'declared_demo' AS data_provenance
      FROM tenant_consumer_memberships m
      JOIN tenant_scope scope ON scope.id = m.tenant_id
      WHERE LOWER(COALESCE(m.source, '')) = 'demo_login'
    ),
    actor_provenance AS (
      SELECT
        actor.tenant_id,
        actor.consumer_id,
        CASE
          WHEN COUNT(DISTINCT evidence.data_provenance) FILTER (WHERE evidence.data_provenance IS NOT NULL) > 1 THEN 'mixed'
          WHEN BOOL_OR(evidence.data_provenance = 'operational_tap') THEN 'operational_tap'
          WHEN BOOL_OR(evidence.data_provenance = 'declared_demo') THEN 'declared_demo'
          WHEN BOOL_OR(evidence.data_provenance = 'imported') THEN 'imported'
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM actor_keys actor
      LEFT JOIN actor_event_evidence evidence
        ON evidence.tenant_id = actor.tenant_id
       AND evidence.consumer_id = actor.consumer_id
      GROUP BY actor.tenant_id, actor.consumer_id
    ),
    operational_actor_evidence AS (
      SELECT tenant_id, consumer_id
      FROM actor_provenance
      WHERE data_provenance = 'operational_tap'
    ),
    product_base AS (
      SELECT
        product.id,
        product.tenant_id,
        product.consumer_id,
        product.tag_id,
        product.product_passport_id,
        product.first_tap_event_id,
        product.latest_tap_event_id
      FROM consumer_products product
      JOIN tenant_scope scope ON scope.id = product.tenant_id
    ),
    product_event_references AS (
      SELECT
        product.id AS product_id,
        product.tenant_id,
        history.tap_event_id AS event_id
      FROM product_base product
      JOIN consumer_tap_history history
        ON history.tenant_id = product.tenant_id
       AND history.consumer_id = product.consumer_id
      JOIN consumer_event_evidence linked_event
        ON linked_event.tenant_id = history.tenant_id
       AND linked_event.id = history.tap_event_id
      WHERE (
        product.tag_id IS NOT NULL
        AND linked_event.tag_id::text = product.tag_id::text
      ) OR (
        NULLIF(BTRIM(product.product_passport_id), '') IS NOT NULL
        AND UPPER(linked_event.uid_hex) = UPPER(product.product_passport_id)
      )
      UNION
      SELECT
        product.id AS product_id,
        product.tenant_id,
        event_ref.event_id
      FROM product_base product
      CROSS JOIN LATERAL (
        VALUES (product.first_tap_event_id), (product.latest_tap_event_id)
      ) AS event_ref(event_id)
      WHERE event_ref.event_id IS NOT NULL
    ),
    product_event_evidence AS (
      SELECT
        reference.product_id,
        COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM product_event_references reference
      LEFT JOIN consumer_event_evidence e
        ON e.tenant_id = reference.tenant_id
       AND e.id = reference.event_id
    ),
    product_provenance AS (
      SELECT
        product.id AS product_id,
        CASE
          WHEN COUNT(DISTINCT evidence.data_provenance) FILTER (WHERE evidence.data_provenance IS NOT NULL) > 1 THEN 'mixed'
          WHEN BOOL_OR(evidence.data_provenance = 'operational_tap') THEN 'operational_tap'
          WHEN BOOL_OR(evidence.data_provenance = 'declared_demo') THEN 'declared_demo'
          WHEN BOOL_OR(evidence.data_provenance = 'imported') THEN 'imported'
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM product_base product
      LEFT JOIN product_event_evidence evidence ON evidence.product_id = product.id
      GROUP BY product.id
    ),
    tap_activity AS (
      SELECT
        COUNT(*) FILTER (WHERE e.data_provenance = 'operational_tap')::int AS total_taps,
        COUNT(*) FILTER (
          WHERE e.data_provenance = 'operational_tap'
            AND EXISTS (
              SELECT 1
              FROM consumer_event_evidence linked_event
              WHERE linked_event.tenant_id = e.tenant_id
                AND linked_event.id = e.id
                AND linked_event.data_provenance = 'operational_tap'
            )
            AND EXISTS (
              SELECT 1
              FROM consumer_tap_history h
              JOIN operational_actor_evidence actor
                ON actor.tenant_id = h.tenant_id
               AND actor.consumer_id = h.consumer_id
              WHERE h.tenant_id = e.tenant_id
                AND h.tap_event_id = e.id
                AND h.consumer_id IS NOT NULL
            )
        )::int AS taps_with_known_actor
      FROM consumer_event_evidence e
    ),
    event_provenance AS (
      SELECT
        COUNT(*) FILTER (WHERE data_provenance = 'operational_tap')::int AS provenance_operational_tap,
        COUNT(*) FILTER (WHERE data_provenance = 'declared_demo')::int AS provenance_declared_demo,
        COUNT(*) FILTER (WHERE data_provenance = 'imported')::int AS provenance_imported,
        COUNT(*) FILTER (WHERE data_provenance = 'legacy_unclassified')::int AS provenance_legacy_unclassified,
        0::int AS provenance_mixed,
        MAX(created_at) FILTER (WHERE data_provenance = 'operational_tap') AS latest_operational_at
      FROM consumer_event_evidence
    ),
    customer_action_evidence AS (
      SELECT
        a.*,
        COALESCE(e.data_provenance, 'legacy_unclassified') AS data_provenance
      FROM sdk_external_events a
      JOIN tenant_scope t ON t.id = a.tenant_id
      LEFT JOIN consumer_event_evidence e
        ON e.tenant_id = a.tenant_id
       AND e.id::text = a.data->>'sourceTapEventId'
      WHERE a.source = 'public_passport'
    ),
    customer_actions AS (
      SELECT
        COUNT(*) FILTER (WHERE a.data_provenance = 'operational_tap')::int AS customer_actions,
        COUNT(*) FILTER (
          WHERE a.data_provenance = 'operational_tap'
            AND EXISTS (
              SELECT 1
              FROM consumer_tap_history h
              JOIN operational_actor_evidence actor
                ON actor.tenant_id = h.tenant_id
               AND actor.consumer_id = h.consumer_id
              WHERE h.tenant_id = a.tenant_id
                AND h.tap_event_id::text = a.data->>'sourceTapEventId'
                AND h.consumer_id IS NOT NULL
            )
        )::int AS actions_with_known_actor
      FROM customer_action_evidence a
    ),
    unit_provenance AS (
      SELECT
        e.tenant_id,
        e.tag_id,
        CASE
          WHEN COUNT(DISTINCT e.data_provenance) > 1 THEN 'mixed'
          WHEN BOOL_OR(e.data_provenance = 'operational_tap') THEN 'operational_tap'
          WHEN BOOL_OR(e.data_provenance = 'declared_demo') THEN 'declared_demo'
          WHEN BOOL_OR(e.data_provenance = 'imported') THEN 'imported'
          ELSE 'legacy_unclassified'
        END AS data_provenance
      FROM consumer_event_evidence e
      WHERE NULLIF(BTRIM(e.tag_id::text), '') IS NOT NULL
      GROUP BY e.tenant_id, e.tag_id
    ),
    recognized_units AS (
      SELECT COUNT(*)::int AS cnt
      FROM unit_provenance unit
      WHERE unit.data_provenance = 'operational_tap'
    ),
    known_actors AS (
      SELECT COUNT(DISTINCT actor.consumer_id)::int AS cnt
      FROM operational_actor_evidence actor
    ),
    verified_identity_actors AS (
      SELECT COUNT(DISTINCT m.consumer_id)::int AS cnt
      FROM tenant_consumer_memberships m
      JOIN tenant_scope t ON t.id = m.tenant_id
      JOIN operational_actor_evidence actor
        ON actor.tenant_id = m.tenant_id
       AND actor.consumer_id = m.consumer_id
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
      JOIN operational_actor_evidence actor
        ON actor.tenant_id = m.tenant_id
       AND actor.consumer_id = m.consumer_id
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
      JOIN operational_actor_evidence actor
        ON actor.tenant_id = m.tenant_id
       AND actor.consumer_id = m.consumer_id
      WHERE m.status = 'active'
    ),
    saved AS (
      SELECT COUNT(*)::int AS cnt
      FROM product_provenance provenance
      WHERE provenance.data_provenance = 'operational_tap'
    ),
    blocked AS (
      SELECT COUNT(*)::int AS cnt
      FROM consumer_product_ownerships o
      JOIN tenant_scope t ON t.id = o.tenant_id
      JOIN consumer_event_evidence source_event
        ON source_event.id = o.event_id
       AND source_event.tenant_id = o.tenant_id
      WHERE o.status IN ('blocked_replay', 'revoked', 'disputed')
        AND source_event.data_provenance = 'operational_tap'
    ),
    top_products AS (
      SELECT
        COALESCE(e.product_name, 'Producto NFC') AS product_name,
        COALESCE(b.bid, 'n/a') AS bid,
        COUNT(*)::int AS claims
      FROM consumer_product_ownerships o
      JOIN tenant_scope t ON t.id = o.tenant_id
      JOIN consumer_event_evidence source_event
        ON source_event.id = o.event_id
       AND source_event.tenant_id = o.tenant_id
       AND source_event.data_provenance = 'operational_tap'
      JOIN event_evidence e
        ON e.id = source_event.id
       AND e.tenant_id = source_event.tenant_id
       AND e.data_provenance = 'operational_tap'
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
      (SELECT provenance_operational_tap FROM event_provenance) AS provenance_operational_tap,
      (SELECT provenance_declared_demo FROM event_provenance) AS provenance_declared_demo,
      (SELECT provenance_imported FROM event_provenance) AS provenance_imported,
      (SELECT provenance_legacy_unclassified FROM event_provenance) AS provenance_legacy_unclassified,
      (SELECT provenance_mixed FROM event_provenance) AS provenance_mixed,
      (SELECT latest_operational_at FROM event_provenance) AS latest_operational_at,
      COALESCE((SELECT json_agg(row_to_json(top_products)) FROM top_products), '[]'::json) AS top_products_by_claims
  `;
  const row = rows[0] || {};
  const metric = (key: string) => readConsumerNetworkAggregateCount(row[key], key);
  const overview = computeConsumerNetworkOverview({
    totalTaps: metric("total_taps"),
    customerActions: metric("customer_actions"),
    tapsWithKnownActor: metric("taps_with_known_actor"),
    actionsWithKnownActor: metric("actions_with_known_actor"),
    recognizedUnits: metric("recognized_units"),
    knownActors: metric("known_actors"),
    verifiedIdentityActors: metric("verified_identity_actors"),
    activeTenantMembers: metric("active_tenant_members"),
    consentedEmailActors: metric("consented_email_actors"),
    consentedWhatsappActors: metric("consented_whatsapp_actors"),
    consentedPhoneActors: metric("consented_phone_actors"),
    savedProducts: metric("saved_products"),
    riskBlockedClaims: metric("risk_blocked_claims"),
  });
  const provenance = consumerNetworkProvenanceFromRow(row);

  return json({
    ok: true,
    tenant: tenant || null,
    overview,
    provenance,
    identityBoundary: "Los UID, tags, direcciones IP y dispositivos identifican actividad o unidades; no se interpretan como personas.",
    topProductsByClaims: Array.isArray(row.top_products_by_claims) ? row.top_products_by_claims : [],
  }, 200, NO_STORE);
}
