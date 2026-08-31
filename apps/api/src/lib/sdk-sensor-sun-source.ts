import { sql, type SqlExecutor } from "./db";
import {
  projectSdkSensorTimelineRows,
  SDK_SENSOR_EVENT_SOURCE,
  SDK_SENSOR_READING_EVENT_TYPE,
  type SdkSensorTimelineReading,
} from "./sdk-sensor-event";

export type SdkSensorTarget = {
  tenantId: string;
  batchId: string;
  tagId: string;
  bid: string;
  uidHex: string;
};

function text(value: unknown, maxLength: number): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized
    && normalized.length <= maxLength
    && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

/**
 * Resolves the physical unit inside the authenticated tenant. Sensor readings
 * are never accepted for a BID alone because that would attribute batch-level
 * data to an arbitrary NFC unit in the public passport.
 */
export async function resolveSdkSensorTarget(input: {
  tenantId: string;
  bid: string;
  uidHex: string;
}, query: SqlExecutor = sql): Promise<SdkSensorTarget | null> {
  const rows = await query/*sql*/`
    SELECT
      batch.tenant_id::text AS tenant_id,
      batch.id::text AS batch_id,
      tag.id::text AS tag_id,
      batch.bid,
      upper(tag.uid_hex) AS uid_hex
    FROM public.batches batch
    JOIN public.tags tag ON tag.batch_id = batch.id
    WHERE batch.tenant_id = ${input.tenantId}::uuid
      AND batch.bid = ${input.bid}
      AND upper(tag.uid_hex) = upper(${input.uidHex})
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const tenantId = text(row.tenant_id, 64);
  const batchId = text(row.batch_id, 64);
  const tagId = text(row.tag_id, 64);
  const bid = text(row.bid, 160);
  const uidHex = text(row.uid_hex, 64);
  if (!tenantId || !batchId || !tagId || !bid || !uidHex) return null;
  return { tenantId, batchId, tagId, bid, uidHex };
}

/**
 * Reads only the documented sensor allowlist from SDK storage. The joins bind
 * every reading to the same tenant, batch and registered tag before it can be
 * projected into SUN; arbitrary external-event JSON is neither selected nor
 * returned to the public contract.
 */
export async function listSdkSensorTimeline(input: {
  tenantId: string;
  bid: string;
  uidHex: string;
  limit?: number;
}, query: SqlExecutor = sql): Promise<SdkSensorTimelineReading[]> {
  const limit = Math.max(1, Math.min(24, Math.trunc(input.limit ?? 6)));
  const rows = await query/*sql*/`
    SELECT
      external_event.created_at::text AS received_at,
      external_event.occurred_at::text AS occurred_at,
      external_event.data #>> '{sensors,measuredAt}' AS measured_at,
      external_event.data #>> '{sensors,temperatureC}' AS temperature_c,
      external_event.data #>> '{sensors,humidityPct}' AS humidity_pct,
      external_event.data #>> '{sensors,lightExposure}' AS light_exposure,
      external_event.data #>> '{sensors,transitShock}' AS transit_shock,
      external_event.data #>> '{sensors,deviceId}' AS device_id,
      external_event.data #>> '{sensors,source}' AS sensor_source,
      external_event.data #>> '{sensors,stage}' AS stage
    FROM public.sdk_external_events external_event
    JOIN public.batches batch
      ON batch.id = external_event.batch_id
     AND batch.tenant_id = external_event.tenant_id
     AND batch.bid = external_event.bid
    JOIN public.tags tag
      ON tag.id = external_event.tag_id
     AND tag.batch_id = batch.id
     AND upper(tag.uid_hex) = upper(external_event.uid_hex)
    WHERE external_event.tenant_id = ${input.tenantId}::uuid
      AND external_event.bid = ${input.bid}
      AND upper(external_event.uid_hex) = upper(${input.uidHex})
      AND external_event.event_type = ${SDK_SENSOR_READING_EVENT_TYPE}
      AND external_event.source = ${SDK_SENSOR_EVENT_SOURCE}
      AND jsonb_typeof(external_event.data) = 'object'
      AND jsonb_object_length(external_event.data) = 1
      AND jsonb_typeof(external_event.data->'sensors') = 'object'
      AND external_event.data #>> '{sensors,nexidExpectedBatchId}' = external_event.batch_id::text
      AND external_event.data #>> '{sensors,nexidExpectedTagId}' = external_event.tag_id::text
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_object_keys(external_event.data->'sensors') AS sensor_key(key)
        WHERE sensor_key.key NOT IN (
          'temperatureC', 'humidityPct', 'lightExposure', 'transitShock',
          'measuredAt', 'deviceId', 'source', 'stage',
          'nexidExpectedBatchId', 'nexidExpectedTagId'
        )
      )
    ORDER BY COALESCE(external_event.occurred_at, external_event.created_at) DESC,
      external_event.id DESC
    LIMIT ${limit}
  `;

  return projectSdkSensorTimelineRows(rows as Array<Record<string, unknown>>);
}
