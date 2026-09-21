import { normalizeTenantTapRealtimeEvent, normalizeEventDataProvenance, type TenantTapRealtimeEvent } from "@product/core";

import { sql, type SqlExecutor } from "./db";
import { withConsumerNetworkEventProvenance } from "./consumer-network-provenance";
import { publishRealtimeEvent } from "./realtime-events";
import { projectConsentedPostTapLocation } from "./post-tap-location-projection";

function positiveEventId(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Build the same tenant-scoped projection consumed by the dashboard snapshot.
 * This is one post-commit read per mutation, not a reconciliation poll. It keeps
 * cross-instance push events semantically aligned with persisted truth.
 */
export async function loadTenantTapRealtimeProjection(
  eventIdInput: unknown,
  execute: SqlExecutor = sql,
): Promise<TenantTapRealtimeEvent | null> {
  const eventId = positiveEventId(eventIdInput);
  if (!eventId) return null;

  const read = withConsumerNetworkEventProvenance(execute, { event: "e", batch: "b", tag: "provenance_tag" });
  const rows = await read/*sql*/`
    SELECT
      e.id,
      e.tenant_id,
      e.batch_id,
      e.tag_id,
      COALESCE(
        NULLIF(e.product_name, ''),
        NULLIF(b.sdm_config->>'product_name', ''),
        NULLIF(b.sdm_config #>> '{sun,product,name}', ''),
        NULLIF(b.sdm_config->>'sku', ''),
        NULLIF(b.sdm_config #>> '{sun,product,sku}', '')
      ) AS product_name,
      e.result,
      e.event_type,
      e.verdict,
      e.risk_level,
      e.cmac_ok,
      e.allowlisted,
      (
        SELECT COUNT(DISTINCT actor_history.consumer_id)::int
        FROM consumer_tap_history actor_history
        WHERE actor_history.tenant_id = e.tenant_id
          AND actor_history.tap_event_id = e.id
          AND actor_history.consumer_id IS NOT NULL
      ) AS known_actor_count,
      EXISTS (
        SELECT 1
        FROM consumer_tap_history actor_history
        WHERE actor_history.tenant_id = e.tenant_id
          AND actor_history.tap_event_id = e.id
          AND actor_history.consumer_id IS NOT NULL
      ) AS known_actor,
      COALESCE(ARRAY(
        SELECT DISTINCT CASE
          WHEN LOWER(consent.scope) IN ('whatsapp', 'whatsapp_marketing') THEN 'whatsapp'
          WHEN LOWER(consent.scope) = 'phone_marketing' THEN 'phone'
          WHEN LOWER(consent.scope) IN ('email', 'email_marketing') THEN 'email'
        END
        FROM consumer_tap_history consent_history
        JOIN consumer_tenant_consents consent
          ON consent.tenant_id = consent_history.tenant_id
         AND consent.consumer_id = consent_history.consumer_id
        WHERE consent_history.tenant_id = e.tenant_id
          AND consent_history.tap_event_id = e.id
          AND consent_history.consumer_id IS NOT NULL
          AND consent.granted = true
          AND consent.revoked_at IS NULL
          AND LOWER(consent.scope) IN (
            'whatsapp', 'whatsapp_marketing', 'phone_marketing',
            'email', 'email_marketing'
          )
      ), ARRAY[]::text[]) AS commercial_consent_channels,
      EXISTS (
        SELECT 1
        FROM consumer_tap_history cth
        JOIN consumer_tenant_consents consent
          ON consent.tenant_id = cth.tenant_id
         AND consent.consumer_id = cth.consumer_id
        WHERE cth.tenant_id = e.tenant_id
          AND cth.tap_event_id = e.id
          AND cth.consumer_id IS NOT NULL
          AND consent.granted = true
          AND consent.revoked_at IS NULL
          AND LOWER(consent.scope) IN (
            'whatsapp', 'whatsapp_marketing', 'phone_marketing',
            'email', 'email_marketing'
          )
      ) AS commercial_consent_granted,
      e.reason,
      e.uid_hex,
      e.created_at,
      e.city,
      e.country_code,
      e.lat,
      e.lng,
      e.location_source,
      e.location_accuracy_m,
      to_jsonb(e)->'post_tap_location_observation' AS post_tap_location_observation,
      e.device_label,
      e.user_agent,
      e.meta,
      COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
      e.source,
      CASE
        WHEN e.source::text = 'real'
          AND e.event_type::text IN ('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT')
          AND EXISTS (
            SELECT 1 FROM events ambiguous_event
            WHERE ambiguous_event.tenant_id = e.tenant_id
              AND ambiguous_event.id = e.id
              AND ambiguous_event.created_at <> e.created_at
          ) THEN 'legacy_unclassified'
        ELSE /* consumer-network-event-provenance */
      END AS data_provenance,
      t.slug AS tenant_slug
    FROM events e
    JOIN batches b
      ON b.id = e.batch_id
     AND b.tenant_id = e.tenant_id
    LEFT JOIN tags provenance_tag
      ON provenance_tag.id::text = e.tag_id::text
     AND provenance_tag.batch_id = e.batch_id
     AND UPPER(provenance_tag.uid_hex) = UPPER(e.uid_hex)
    JOIN tenants t ON t.id = e.tenant_id
    WHERE e.id = ${eventId}
    LIMIT 1
  `;
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const projection = normalizeTenantTapRealtimeEvent(projectConsentedPostTapLocation(rows[0] as Record<string, unknown>));
  if (!projection.eventId || !projection.tenantId || !projection.tenantSlug || !projection.batchId) return null;
  return projection;
}

export function readEmbeddedTenantTapProjection(value: unknown): TenantTapRealtimeEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const projection = value as Partial<TenantTapRealtimeEvent>;
  if (
    !projection.eventId
    || !projection.tenantId
    || !projection.tenantSlug
    || !projection.batchId
    || !projection.occurredAt
    || !projection.eventType
    || !projection.eventSource
    || !Array.isArray(projection.commercialConsentChannels)
  ) return null;
  return { ...projection, dataProvenance: normalizeEventDataProvenance(projection.dataProvenance) } as TenantTapRealtimeEvent;
}

export async function publishTenantTapRealtimeProjection(
  eventId: unknown,
  traceId: string | null = null,
) {
  const projection = await loadTenantTapRealtimeProjection(eventId);
  if (!projection) return { projected: false, distributed: false };
  const published = await publishRealtimeEvent({
    id: projection.eventId,
    event_type: projection.eventType,
    tenant_id: projection.tenantId || undefined,
    tenant_slug: projection.tenantSlug || undefined,
    batch_id: projection.batchId || undefined,
    bid: projection.bid || undefined,
    tag_id: projection.tagId || undefined,
    verdict: projection.verdict,
    risk_level: projection.riskLevel,
    result: projection.result,
    city: projection.city || null,
    country_code: projection.country || null,
    lat: projection.lat ?? null,
    lng: projection.lng ?? null,
    location_source: projection.locationSource || null,
    location_accuracy_m: projection.locationAccuracyM ?? null,
    device_os: projection.deviceOs || null,
    device_type: projection.deviceType || null,
    product_name: projection.productName || undefined,
    source: projection.eventSource,
    created_at: projection.occurredAt,
    tap_projection: projection as unknown as Record<string, unknown>,
  });
  return { projected: true, distributed: published.distributed };
}
