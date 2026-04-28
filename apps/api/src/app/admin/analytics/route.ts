export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { addBucket, normalizeBrowser, normalizeDeviceType, normalizeOs, normalizeTimezone, parseAnalyticsFilters, toSortedBuckets } from "../../../lib/analytics";
import { aggregateTenantMetrics } from "@product/core";

type TrendRow = { day: string; scans: number; duplicates: number; tamper: number };

type GeoRow = {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  scans: number;
  risk: number;
};

type DeviceRow = {
  device: string | null;
  scans: number;
  countries: number;
  valid: number;
  risk: number;
};

type JourneyRow = {
  uid_hex: string | null;
  taps: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  origin_city: string | null;
  origin_country: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  current_city: string | null;
  current_country: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_device: string | null;
};

type CountryRow = { country: string | null; scans: number; risk: number };
type CityRow = { city: string | null; country: string | null; lat: number | null; lng: number | null; scans: number; risk: number; last_seen: string | null };
type DeviceBucketRow = { label: string | null; count: number };
type FeedRow = { id: number; uid_hex: string | null; bid: string | null; result: string; city: string | null; country_code: string | null; device: string | null; created_at: string };
type ProductRow = {
  uid_hex: string;
  bid: string;
  product_name: string | null;
  winery: string | null;
  region: string | null;
  vintage: string | null;
  scan_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_verified_city: string | null;
  last_verified_country: string | null;
  tokenization_status: string | null;
  tokenization_network: string | null;
  tokenization_tx_hash: string | null;
  tokenization_token_id: string | null;
};

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const { tenant, source, range, rangeSql, country } = parseAnalyticsFilters(searchParams);

  const [overviewRows, trendRows, batchRows, geoRows, deviceRows, journeyRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked,
          COUNT(DISTINCT b.id)::int AS active_batches,
          COUNT(DISTINCT tn.id)::int AS active_tenants
        FROM tenants tn
        LEFT JOIN batches b ON b.tenant_id = tn.id
        LEFT JOIN events e ON e.batch_id = b.id
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        WHERE tn.slug = ${tenant}
      `
      : sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active')::int AS active_batches,
          COUNT(DISTINCT tn.id)::int AS active_tenants
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN events e ON e.batch_id = b.id
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
      `,
    tenant
      ? sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY min(e.created_at)
      `
      : sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict IN ('tampered', 'not_registered', 'not_active') OR e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY min(e.created_at)
      `,
    tenant
      ? sql/*sql*/`
        SELECT status, COUNT(*)::int AS value
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
        GROUP BY status
      `
      : sql/*sql*/`
        SELECT status, COUNT(*)::int AS value
        FROM batches
        GROUP BY status
      `,
    tenant
      ? sql/*sql*/`
        SELECT e.geo_city AS city,
          e.geo_country AS country,
          AVG(e.geo_lat)::float8 AS lat,
          AVG(e.geo_lng)::float8 AS lng,
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.geo_lat IS NOT NULL
          AND e.geo_lng IS NOT NULL
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY e.geo_city, e.geo_country
        ORDER BY scans DESC
        LIMIT 20
      `
      : sql/*sql*/`
        SELECT e.geo_city AS city,
          e.geo_country AS country,
          AVG(e.geo_lat)::float8 AS lat,
          AVG(e.geo_lng)::float8 AS lng,
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        WHERE e.geo_lat IS NOT NULL
          AND e.geo_lng IS NOT NULL
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY e.geo_city, e.geo_country
        ORDER BY scans DESC
        LIMIT 20
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.device_label, ''), split_part(COALESCE(e.user_agent, ''), ' ', 1), 'Unknown device') AS device,
          COUNT(*)::int AS scans,
          COUNT(DISTINCT COALESCE(e.geo_country, e.country_code, '--'))::int AS countries,
          COUNT(*) FILTER (WHERE e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.device_label, ''), split_part(COALESCE(e.user_agent, ''), ' ', 1), 'Unknown device') AS device,
          COUNT(*)::int AS scans,
          COUNT(DISTINCT COALESCE(e.geo_country, e.country_code, '--'))::int AS countries,
          COUNT(*) FILTER (WHERE e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 8
      `,
    tenant
      ? sql/*sql*/`
        WITH scoped_events AS (
          SELECT
            e.uid_hex,
            e.created_at,
            e.geo_city,
            e.geo_country,
            e.city,
            e.country_code,
            e.geo_lat,
            e.geo_lng,
            e.lat,
            e.lng,
            e.device_label,
            e.user_agent
          FROM events e
          JOIN tenants tn ON tn.id = e.tenant_id
          WHERE tn.slug = ${tenant}
            AND e.uid_hex IS NOT NULL
            AND e.created_at >= now() - ${rangeSql}::interval
            AND (${source} = '' OR e.source = ${source}::text)
        ),
        ranked AS (
          SELECT
            uid_hex,
            created_at,
            COALESCE(NULLIF(geo_city, ''), NULLIF(city, ''), 'Unknown') AS city,
            COALESCE(NULLIF(geo_country, ''), NULLIF(country_code, ''), '--') AS country,
            COALESCE(geo_lat, lat) AS lat,
            COALESCE(geo_lng, lng) AS lng,
            COALESCE(NULLIF(device_label, ''), split_part(COALESCE(user_agent, ''), ' ', 1), 'Unknown device') AS device,
            ROW_NUMBER() OVER (PARTITION BY uid_hex ORDER BY created_at ASC) AS rn_first,
            ROW_NUMBER() OVER (PARTITION BY uid_hex ORDER BY created_at DESC) AS rn_last
          FROM scoped_events
        ),
        totals AS (
          SELECT uid_hex, COUNT(*)::int AS taps
          FROM scoped_events
          GROUP BY uid_hex
        )
        SELECT
          t.uid_hex,
          t.taps,
          first_event.created_at AS first_seen_at,
          last_event.created_at AS last_seen_at,
          first_event.city AS origin_city,
          first_event.country AS origin_country,
          first_event.lat AS origin_lat,
          first_event.lng AS origin_lng,
          last_event.city AS current_city,
          last_event.country AS current_country,
          last_event.lat AS current_lat,
          last_event.lng AS current_lng,
          last_event.device AS last_device
        FROM totals t
        LEFT JOIN ranked first_event ON first_event.uid_hex = t.uid_hex AND first_event.rn_first = 1
        LEFT JOIN ranked last_event ON last_event.uid_hex = t.uid_hex AND last_event.rn_last = 1
        ORDER BY t.taps DESC, last_event.created_at DESC NULLS LAST
        LIMIT 12
      `
      : sql/*sql*/`
        WITH ranked AS (
          SELECT
            e.uid_hex,
            e.created_at,
            COALESCE(NULLIF(e.geo_city, ''), NULLIF(e.city, ''), 'Unknown') AS city,
            COALESCE(NULLIF(e.geo_country, ''), NULLIF(e.country_code, ''), '--') AS country,
            COALESCE(e.geo_lat, e.lat) AS lat,
            COALESCE(e.geo_lng, e.lng) AS lng,
            COALESCE(NULLIF(e.device_label, ''), split_part(COALESCE(e.user_agent, ''), ' ', 1), 'Unknown device') AS device,
            ROW_NUMBER() OVER (PARTITION BY e.uid_hex ORDER BY e.created_at ASC) AS rn_first,
            ROW_NUMBER() OVER (PARTITION BY e.uid_hex ORDER BY e.created_at DESC) AS rn_last
          FROM events e
          WHERE e.uid_hex IS NOT NULL
            AND e.created_at >= now() - ${rangeSql}::interval
            AND (${source} = '' OR e.source = ${source}::text)
        ),
        totals AS (
          SELECT uid_hex, COUNT(*)::int AS taps
          FROM events
          WHERE uid_hex IS NOT NULL
          GROUP BY uid_hex
        )
        SELECT
          t.uid_hex,
          t.taps,
          first_event.created_at AS first_seen_at,
          last_event.created_at AS last_seen_at,
          first_event.city AS origin_city,
          first_event.country AS origin_country,
          first_event.lat AS origin_lat,
          first_event.lng AS origin_lng,
          last_event.city AS current_city,
          last_event.country AS current_country,
          last_event.lat AS current_lat,
          last_event.lng AS current_lng,
          last_event.device AS last_device
        FROM totals t
        LEFT JOIN ranked first_event ON first_event.uid_hex = t.uid_hex AND first_event.rn_first = 1
        LEFT JOIN ranked last_event ON last_event.uid_hex = t.uid_hex AND last_event.rn_last = 1
        ORDER BY t.taps DESC, last_event.created_at DESC NULLS LAST
        LIMIT 12
      `,
  ]);

  const [countryRows, cityRows, deviceOsRows, deviceBrowserRows, timezoneRows, mobileShareRows, feedRows, productRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 12
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 12
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(COALESCE(e.lat, e.geo_lat))::float8 AS lat,
          AVG(COALESCE(e.lng, e.geo_lng))::float8 AS lng,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk,
          MAX(e.created_at)::text AS last_seen
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1,2
        ORDER BY scans DESC
        LIMIT 20
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(COALESCE(e.lat, e.geo_lat))::float8 AS lat,
          AVG(COALESCE(e.lng, e.geo_lng))::float8 AS lng,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','REPLAY_SUSPECT','TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS risk,
          MAX(e.created_at)::text AS last_seen
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1,2
        ORDER BY scans DESC
        LIMIT 20
      `,
    tenant
      ? sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `,
    tenant
      ? sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'browser', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'browser', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `,
    tenant
      ? sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'timezone', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'timezone', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COUNT(*) FILTER (WHERE lower(COALESCE(e.meta->'sun_context'->'client'->>'mobile', 'false')) IN ('true','1','yes'))::int AS mobile_count,
          COUNT(*)::int AS total_count
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
      `
      : sql/*sql*/`
        SELECT
          COUNT(*) FILTER (WHERE lower(COALESCE(e.meta->'sun_context'->'client'->>'mobile', 'false')) IN ('true','1','yes'))::int AS mobile_count,
          COUNT(*)::int AS total_count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          e.id,
          e.uid_hex,
          b.bid,
          e.result,
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country_code,
          COALESCE(NULLIF(e.device_label, ''), NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS device,
          e.created_at::text AS created_at
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        ORDER BY e.created_at DESC
        LIMIT 30
      `
      : sql/*sql*/`
        SELECT
          e.id,
          e.uid_hex,
          b.bid,
          e.result,
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country_code,
          COALESCE(NULLIF(e.device_label, ''), NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS device,
          e.created_at::text AS created_at
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source = ${source}::text)
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        ORDER BY e.created_at DESC
        LIMIT 30
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          t.uid_hex,
          b.bid,
          COALESCE(tp.product_name, tp.sku, 'Unprofiled bottle') AS product_name,
          tp.winery,
          tp.region,
          tp.vintage,
          t.scan_count,
          t.first_seen_at::text AS first_seen_at,
          t.last_seen_at::text AS last_seen_at,
          last_evt.city AS last_verified_city,
          last_evt.country_code AS last_verified_country,
          tok.status AS tokenization_status,
          tok.network AS tokenization_network,
          tok.tx_hash AS tokenization_tx_hash,
          tok.token_id AS tokenization_token_id
        FROM tags t
        JOIN batches b ON b.id = t.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
        LEFT JOIN LATERAL (
          SELECT e.city, e.country_code, e.created_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source = ${source}::text)
            AND e.created_at >= now() - ${rangeSql}::interval
          ORDER BY e.created_at DESC
          LIMIT 1
        ) last_evt ON TRUE
        LEFT JOIN LATERAL (
          SELECT tr.status, tr.network, tr.tx_hash, tr.token_id, tr.requested_at
          FROM tokenization_requests tr
          WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
          ORDER BY tr.requested_at DESC
          LIMIT 1
        ) tok ON TRUE
        WHERE tn.slug = ${tenant}
        ORDER BY COALESCE(t.last_seen_at, t.created_at) DESC
        LIMIT 30
      `
      : sql/*sql*/`
        SELECT
          t.uid_hex,
          b.bid,
          COALESCE(tp.product_name, tp.sku, 'Unprofiled bottle') AS product_name,
          tp.winery,
          tp.region,
          tp.vintage,
          t.scan_count,
          t.first_seen_at::text AS first_seen_at,
          t.last_seen_at::text AS last_seen_at,
          last_evt.city AS last_verified_city,
          last_evt.country_code AS last_verified_country,
          tok.status AS tokenization_status,
          tok.network AS tokenization_network,
          tok.tx_hash AS tokenization_tx_hash,
          tok.token_id AS tokenization_token_id
        FROM tags t
        JOIN batches b ON b.id = t.batch_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
        LEFT JOIN LATERAL (
          SELECT e.city, e.country_code, e.created_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source = ${source}::text)
            AND e.created_at >= now() - ${rangeSql}::interval
          ORDER BY e.created_at DESC
          LIMIT 1
        ) last_evt ON TRUE
        LEFT JOIN LATERAL (
          SELECT tr.status, tr.network, tr.tx_hash, tr.token_id, tr.requested_at
          FROM tokenization_requests tr
          WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
          ORDER BY tr.requested_at DESC
          LIMIT 1
        ) tok ON TRUE
        ORDER BY COALESCE(t.last_seen_at, t.created_at) DESC
        LIMIT 30
      `,
  ]);

  const overview = (overviewRows[0] || {
    scans: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    tamper: 0,
    active_batches: 0,
    active_tenants: 0,
  }) as Record<string, number>;

  const scansTotal = Number(overview.scans || 0);
  const duplicates = Number(overview.duplicates || 0);
  const tamper = Number(overview.tamper || 0);
  const invalid = Number(overview.invalid || 0);
  const revoked = Number((overview as Record<string, number>).revoked || 0);
  const metrics = aggregateTenantMetrics({
    counts: { scans: scansTotal, valid: Number(overview.valid || 0), invalid, duplicates, tamper, revoked },
  });

  const trend = (trendRows as TrendRow[]).map((row) => ({
    day: row.day,
    scans: Number(row.scans || 0),
    duplicates: Number(row.duplicates || 0),
    tamper: Number(row.tamper || 0),
  }));

  const batchMap = new Map((batchRows as Array<{ status: string; value: number }>).map((row) => [row.status, Number(row.value || 0)]));
  const batchStatus = [
    { name: "Active", value: batchMap.get("active") || 0 },
    { name: "Pending", value: batchMap.get("pending") || 0 },
    { name: "Revoked", value: batchMap.get("revoked") || 0 },
  ];

  const geoPoints = (geoRows as GeoRow[])
    .filter((row) => typeof row.lat === "number" && typeof row.lng === "number")
    .map((row) => ({
      city: row.city || "Unknown",
      country: row.country || "--",
      lat: Number(row.lat),
      lng: Number(row.lng),
      scans: Number(row.scans || 0),
      risk: Number(row.risk || 0),
    }));

  const deviceSignals = (deviceRows as DeviceRow[]).map((row) => ({
    device: row.device || "Unknown device",
    scans: Number(row.scans || 0),
    countries: Number(row.countries || 0),
    validRate: row.scans ? Number(((Number(row.valid || 0) / Number(row.scans || 1)) * 100).toFixed(1)) : 0,
    risk: Number(row.risk || 0),
  }));

  const tagJourney = (journeyRows as JourneyRow[])
    .filter((row) => row.uid_hex)
    .map((row) => ({
      uid: row.uid_hex as string,
      taps: Number(row.taps || 0),
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      origin: {
        city: row.origin_city || "Unknown",
        country: row.origin_country || "--",
        lat: typeof row.origin_lat === "number" ? Number(row.origin_lat) : null,
        lng: typeof row.origin_lng === "number" ? Number(row.origin_lng) : null,
      },
      current: {
        city: row.current_city || "Unknown",
        country: row.current_country || "--",
        lat: typeof row.current_lat === "number" ? Number(row.current_lat) : null,
        lng: typeof row.current_lng === "number" ? Number(row.current_lng) : null,
      },
      lastDevice: row.last_device || "Unknown device",
    }));

  const osBuckets = new Map<string, number>();
  for (const row of (deviceOsRows as DeviceBucketRow[])) addBucket(osBuckets, normalizeOs({ platform: row.label }), Number(row.count || 0));
  const browserBuckets = new Map<string, number>();
  for (const row of (deviceBrowserRows as DeviceBucketRow[])) addBucket(browserBuckets, normalizeBrowser({ browser: row.label }), Number(row.count || 0));
  const timezoneBuckets = new Map<string, number>();
  for (const row of (timezoneRows as DeviceBucketRow[])) addBucket(timezoneBuckets, normalizeTimezone(row.label), Number(row.count || 0));
  const mobileBase = (mobileShareRows?.[0] || { mobile_count: 0, total_count: 0 }) as { mobile_count?: number; total_count?: number };
  const totalDevices = Number(mobileBase.total_count || 0);
  const mobileCount = Number(mobileBase.mobile_count || 0);
  const desktopCount = Math.max(totalDevices - mobileCount, 0);
  const deviceTypeBuckets = new Map<string, number>();
  if (mobileCount > 0) addBucket(deviceTypeBuckets, normalizeDeviceType({ mobile: true }), mobileCount);
  if (desktopCount > 0) addBucket(deviceTypeBuckets, normalizeDeviceType({ mobile: false }), desktopCount);

  return json({
    kpis: {
      scans: scansTotal,
      validRate: metrics.validRate,
      invalidRate: metrics.invalidRate,
      duplicates,
      tamper,
      activeBatches: Number(overview.active_batches || 0),
      activeTenants: Number(overview.active_tenants || 0),
      geoRegions: geoPoints.length,
      resellerPerformance: Number((overview.scans || 0) * 1.8),
      riskScore: metrics.riskScore,
    },
    scope: {
      tenant: tenant || "global",
      source: source || "all",
      range,
      country: country || "all",
    },
    riskBreakdown: metrics.riskBreakdown,
    geography: {
      countries: (countryRows as CountryRow[]).map((row) => ({
        country: row.country || "--",
        scans: Number(row.scans || 0),
        risk: Number(row.risk || 0),
      })),
      cities: (cityRows as CityRow[]).map((row) => ({
        city: row.city || "Unknown",
        country: row.country || "--",
        lat: typeof row.lat === "number" ? Number(row.lat) : null,
        lng: typeof row.lng === "number" ? Number(row.lng) : null,
        scans: Number(row.scans || 0),
        risk: Number(row.risk || 0),
        lastSeen: row.last_seen,
      })),
    },
    devices: {
      os: toSortedBuckets(osBuckets),
      browser: toSortedBuckets(browserBuckets),
      deviceType: toSortedBuckets(deviceTypeBuckets, 4),
      timezones: toSortedBuckets(timezoneBuckets),
      mobileShare: totalDevices ? Number((mobileCount / totalDevices).toFixed(4)) : 0,
    },
    feed: (feedRows as FeedRow[]).map((row) => ({
      id: Number(row.id),
      uidHex: row.uid_hex || "",
      bid: row.bid || "",
      result: row.result,
      city: row.city || "Unknown",
      country: row.country_code || "--",
      device: row.device || "Unknown",
      createdAt: row.created_at,
    })),
    products: (productRows as ProductRow[]).map((row) => ({
      uidHex: row.uid_hex,
      bid: row.bid,
      productName: row.product_name || "Unprofiled bottle",
      winery: row.winery || "-",
      region: row.region || "-",
      vintage: row.vintage || "-",
      scanCount: Number(row.scan_count || 0),
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      lastVerifiedCity: row.last_verified_city || "-",
      lastVerifiedCountry: row.last_verified_country || "-",
      tokenization: {
        status: row.tokenization_status || "none",
        network: row.tokenization_network || "-",
        txHash: row.tokenization_tx_hash || null,
        tokenId: row.tokenization_token_id || null,
      },
    })),
    trend,
    batchStatus,
    geoPoints,
    deviceSignals,
    tagJourney,
  });
}
