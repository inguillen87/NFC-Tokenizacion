export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminPermission, checkAdminWithPermission, getAdminTenantAccess } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { addBucket, normalizeBrowser, normalizeDeviceType, normalizeOs, normalizeTimezone, parseAnalyticsFilters, toSortedBuckets } from "../../../lib/analytics";
import { SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE } from "../../../lib/sun-automated-fetch";
import { aggregateTenantMetrics, EVENT_TAXONOMY_VERSION } from "@product/core";
import { classifyPhysicalTapSealState, isAuthenticatedNfcMessage, listAdminPhysicalTaps } from "../../../lib/admin-physical-taps";

type TrendRow = { day: string; scans: number; product_recognized: number; identified_unverified: number; authentication_verified: number; valid: number; closed: number; opened: number; duplicates: number; tamper: number; invalid: number; unregistered: number; inactive: number };

type GeoRow = {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  scans: number;
  risk: number;
  browser_gps_count: number;
  ip_approx_count: number;
  coordinate_count: number;
  accuracy_m: number | null;
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
type CityRow = {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  scans: number;
  risk: number;
  last_seen: string | null;
  browser_gps_count: number;
  ip_approx_count: number;
  coordinate_count: number;
  accuracy_m: number | null;
};
type DeviceBucketRow = { label: string | null; count: number };
type FeedRow = { id: number; uid_hex: string | null; bid: string | null; event_type: string | null; result: string; verdict: string | null; reason: string | null; cmac_ok: boolean | null; allowlisted: boolean | null; source: string | null; city: string | null; country_code: string | null; device: string | null; created_at: string };
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
  winery_lat: number | null;
  winery_lng: number | null;
  winery_address: string | null;
  provenance_text: string | null;
};

function coordinateProvenance(
  row: Pick<GeoRow, "browser_gps_count" | "ip_approx_count" | "coordinate_count" | "accuracy_m">,
) {
  const browserGpsCount = Number(row.browser_gps_count || 0);
  const ipApproxCount = Number(row.ip_approx_count || 0);
  const coordinateCount = Number(row.coordinate_count || 0);
  const unknownCount = Math.max(coordinateCount - browserGpsCount - ipApproxCount, 0);
  const coordinateSource = coordinateCount > 0 && browserGpsCount === coordinateCount
      ? "browser_approximate_consent"
      : coordinateCount > 0 && ipApproxCount === coordinateCount
        ? "ip_approx"
        : coordinateCount > 0
          ? "mixed_or_unknown_approx"
          : "unknown";
  return {
    coordinateSource,
    coordinateAccuracyMeters: coordinateSource === "browser_approximate_consent" && typeof row.accuracy_m === "number"
      ? Number(row.accuracy_m)
      : null,
    coordinateSampleCount: coordinateCount,
    coordinateIsApproximate: true,
    coordinateEvidence: coordinateCount > 0 ? "persisted_event" : "none",
    coordinateSourceCounts: {
      browserGpsReported: browserGpsCount,
      ipApprox: ipApproxCount,
      unknown: unknownCount,
    },
  };
}

function validCoordinatePair(latValue: unknown, lngValue: unknown) {
  const lat = typeof latValue === "number" ? latValue : typeof latValue === "string" && latValue.trim() ? Number(latValue) : Number.NaN;
  const lng = typeof lngValue === "number" ? lngValue : typeof lngValue === "string" && lngValue.trim() ? Number(lngValue) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "analytics:read");
  if (auth) return auth;
  // This legacy payload contains stable NFC identifiers, device labels and
  // event-derived coordinates. `reports.export` alone is intentionally not
  // enough for event-level or location-sensitive data.
  const sensitive = checkAdminPermission(req, "events.read_sensitive");
  if (sensitive) return sensitive;

  const { searchParams } = new URL(req.url);
  const { tenant: requestedTenant, source: requestedSource, range, rangeSql, country } = parseAnalyticsFilters(searchParams);
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);
  // Real operational analytics fail closed. Demo/simulated events remain
  // queryable only through an explicit `source=demo` filter.
  const source = requestedSource || "real";
  const [overviewRows, trendRows, batchRows, geoRows, deviceRows, journeyRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND (e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL))::int AS product_recognized,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND (
            LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true')
          ))::int AS identified_unverified,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND LOWER(COALESCE(e.verdict, '')) = 'valid' AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID' AND e.cmac_ok IS TRUE AND e.allowlisted IS TRUE)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'VALID_CLOSED')::int AS closed,
          COUNT(*) FILTER (WHERE e.result IN ('OPENED','OPENED_PREVIOUSLY','MANUAL_OPENED','VALID_OPENED','VALID_OPENED_PREVIOUSLY','VALID_MANUAL_OPENED'))::int AS opened,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict = 'tampered' OR e.result IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED'))::int AS tamper,
          COUNT(*) FILTER (WHERE (e.verdict = 'not_registered' OR e.result = 'NOT_REGISTERED') AND NOT (
            UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
          ))::int AS unregistered,
          COUNT(*) FILTER (WHERE e.verdict = 'not_active' OR e.result = 'NOT_ACTIVE')::int AS inactive,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active')::int AS active_batches,
          COUNT(DISTINCT tn.id) FILTER (WHERE b.status = 'active')::int AS active_tenants
        FROM tenants tn
        LEFT JOIN batches b ON b.tenant_id = tn.id
        LEFT JOIN events e ON e.batch_id = b.id AND e.tenant_id = tn.id
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        WHERE tn.slug = ${tenant}
      `
      : sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND (e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL))::int AS product_recognized,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND (
            LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true')
          ))::int AS identified_unverified,
          COUNT(*) FILTER (WHERE e.id IS NOT NULL AND LOWER(COALESCE(e.verdict, '')) = 'valid' AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID' AND e.cmac_ok IS TRUE AND e.allowlisted IS TRUE)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'VALID_CLOSED')::int AS closed,
          COUNT(*) FILTER (WHERE e.result IN ('OPENED','OPENED_PREVIOUSLY','MANUAL_OPENED','VALID_OPENED','VALID_OPENED_PREVIOUSLY','VALID_MANUAL_OPENED'))::int AS opened,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict = 'tampered' OR e.result IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED'))::int AS tamper,
          COUNT(*) FILTER (WHERE (e.verdict = 'not_registered' OR e.result = 'NOT_REGISTERED') AND NOT (
            UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
          ))::int AS unregistered,
          COUNT(*) FILTER (WHERE e.verdict = 'not_active' OR e.result = 'NOT_ACTIVE')::int AS inactive,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active')::int AS active_batches,
          COUNT(DISTINCT tn.id) FILTER (WHERE b.status = 'active')::int AS active_tenants
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN events e ON e.batch_id = b.id AND e.tenant_id = tn.id
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
      `,
    tenant
      ? sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL)::int AS product_recognized,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'))::int AS identified_unverified,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(e.verdict, '')) = 'valid' AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID' AND e.cmac_ok IS TRUE AND e.allowlisted IS TRUE)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'VALID_CLOSED')::int AS closed,
          COUNT(*) FILTER (WHERE e.result IN ('OPENED','OPENED_PREVIOUSLY','MANUAL_OPENED','VALID_OPENED','VALID_OPENED_PREVIOUSLY','VALID_MANUAL_OPENED'))::int AS opened,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict = 'tampered' OR e.result IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE (e.verdict = 'not_registered' OR e.result = 'NOT_REGISTERED') AND NOT (
            UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
          ))::int AS unregistered,
          COUNT(*) FILTER (WHERE e.verdict = 'not_active' OR e.result = 'NOT_ACTIVE')::int AS inactive,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY min(e.created_at)
      `
      : sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL)::int AS product_recognized,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'))::int AS identified_unverified,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(e.verdict, '')) = 'valid' AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID' AND e.cmac_ok IS TRUE AND e.allowlisted IS TRUE)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'VALID_CLOSED')::int AS closed,
          COUNT(*) FILTER (WHERE e.result IN ('OPENED','OPENED_PREVIOUSLY','MANUAL_OPENED','VALID_OPENED','VALID_OPENED_PREVIOUSLY','VALID_MANUAL_OPENED'))::int AS opened,
          COUNT(*) FILTER (WHERE e.verdict IN ('replay_suspect', 'blocked_replay') OR e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.verdict = 'tampered' OR e.result IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED'))::int AS tamper,
          COUNT(*) FILTER (WHERE e.verdict = 'invalid' OR e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE (e.verdict = 'not_registered' OR e.result = 'NOT_REGISTERED') AND NOT (
            UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
          ))::int AS unregistered,
          COUNT(*) FILTER (WHERE e.verdict = 'not_active' OR e.result = 'NOT_ACTIVE')::int AS inactive,
          COUNT(*) FILTER (WHERE e.verdict = 'revoked' OR e.result = 'REVOKED')::int AS revoked
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1
        ORDER BY min(e.created_at)
      `,
    tenant
      ? sql/*sql*/`
        SELECT b.status AS status, COUNT(*)::int AS value
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
        GROUP BY b.status
      `
      : sql/*sql*/`
        SELECT b.status AS status, COUNT(*)::int AS value
        FROM batches b
        GROUP BY b.status
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lat
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lat
          END)::float8 AS lat,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lng
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lng
          END)::float8 AS lng,
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk,
          COUNT(*) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)::int AS browser_gps_count,
          COUNT(*) FILTER (WHERE
            (e.location_source IN ('ip_approx','edge_ip_approx') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR ((e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180) IS NOT TRUE AND e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS ip_approx_count,
          COUNT(*) FILTER (WHERE
            (e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR (e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS coordinate_count,
          AVG(e.location_accuracy_m) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 AND e.location_accuracy_m >= 0)::float8 AS accuracy_m
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1, 2
        ORDER BY scans DESC
        LIMIT 20
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lat
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lat
          END)::float8 AS lat,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lng
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lng
          END)::float8 AS lng,
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk,
          COUNT(*) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)::int AS browser_gps_count,
          COUNT(*) FILTER (WHERE
            (e.location_source IN ('ip_approx','edge_ip_approx') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR ((e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180) IS NOT TRUE AND e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS ip_approx_count,
          COUNT(*) FILTER (WHERE
            (e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR (e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS coordinate_count,
          AVG(e.location_accuracy_m) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 AND e.location_accuracy_m >= 0)::float8 AS accuracy_m
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1, 2
        ORDER BY scans DESC
        LIMIT 20
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.device_label, ''), split_part(COALESCE(e.user_agent, ''), ' ', 1), 'Unknown device') AS device,
          COUNT(*)::int AS scans,
          COUNT(DISTINCT COALESCE(e.geo_country, e.country_code, '--'))::int AS countries,
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
          COUNT(*) FILTER (WHERE e.verdict = 'valid' OR e.result = 'VALID' OR e.result LIKE 'VALID_%')::int AS valid,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        ),
        ranked AS (
          SELECT
            uid_hex,
            created_at,
            COALESCE(NULLIF(geo_city, ''), NULLIF(city, ''), 'Unknown') AS city,
            COALESCE(NULLIF(geo_country, ''), NULLIF(country_code, ''), '--') AS country,
            CASE
              WHEN lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 THEN lat
              WHEN geo_lat BETWEEN -90 AND 90 AND geo_lng BETWEEN -180 AND 180 THEN geo_lat
            END AS lat,
            CASE
              WHEN lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 THEN lng
              WHEN geo_lat BETWEEN -90 AND 90 AND geo_lng BETWEEN -180 AND 180 THEN geo_lng
            END AS lng,
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
        WITH scoped_events AS (
          SELECT *
          FROM events e
          WHERE e.uid_hex IS NOT NULL
            AND e.created_at >= now() - ${rangeSql}::interval
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        ),
        ranked AS (
          SELECT
            e.uid_hex,
            e.created_at,
            COALESCE(NULLIF(e.geo_city, ''), NULLIF(e.city, ''), 'Unknown') AS city,
            COALESCE(NULLIF(e.geo_country, ''), NULLIF(e.country_code, ''), '--') AS country,
            CASE
              WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lat
              WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lat
            END AS lat,
            CASE
              WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lng
              WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lng
            END AS lng,
            COALESCE(NULLIF(e.device_label, ''), split_part(COALESCE(e.user_agent, ''), ' ', 1), 'Unknown device') AS device,
            ROW_NUMBER() OVER (PARTITION BY e.uid_hex ORDER BY e.created_at ASC) AS rn_first,
            ROW_NUMBER() OVER (PARTITION BY e.uid_hex ORDER BY e.created_at DESC) AS rn_last
          FROM scoped_events e
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
      `,
  ]);

  const [countryRows, cityRows, deviceOsRows, deviceBrowserRows, timezoneRows, mobileShareRows, feedRows, productRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 12
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1
        ORDER BY scans DESC
        LIMIT 12
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lat
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lat
          END)::float8 AS lat,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lng
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lng
          END)::float8 AS lng,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk,
          MAX(e.created_at)::text AS last_seen,
          COUNT(*) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)::int AS browser_gps_count,
          COUNT(*) FILTER (WHERE
            (e.location_source IN ('ip_approx','edge_ip_approx') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR ((e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180) IS NOT TRUE AND e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS ip_approx_count,
          COUNT(*) FILTER (WHERE
            (e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR (e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS coordinate_count,
          AVG(e.location_accuracy_m) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 AND e.location_accuracy_m >= 0)::float8 AS accuracy_m
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        GROUP BY 1,2
        ORDER BY scans DESC
        LIMIT 20
      `
      : sql/*sql*/`
        SELECT
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lat
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lat
          END)::float8 AS lat,
          AVG(CASE
            WHEN e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 THEN e.lng
            WHEN e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180 THEN e.geo_lng
          END)::float8 AS lng,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID','DUPLICATE','REPLAY_SUSPECT','TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED','REVOKED'))::int AS risk,
          MAX(e.created_at)::text AS last_seen,
          COUNT(*) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)::int AS browser_gps_count,
          COUNT(*) FILTER (WHERE
            (e.location_source IN ('ip_approx','edge_ip_approx') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR ((e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180) IS NOT TRUE AND e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS ip_approx_count,
          COUNT(*) FILTER (WHERE
            (e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180)
            OR (e.geo_lat BETWEEN -90 AND 90 AND e.geo_lng BETWEEN -180 AND 180)
          )::int AS coordinate_count,
          AVG(e.location_accuracy_m) FILTER (WHERE e.location_source IN ('browser_gps_reported','browser_gps_approximate_consent') AND e.lat BETWEEN -90 AND 90 AND e.lng BETWEEN -180 AND 180 AND e.location_accuracy_m >= 0)::float8 AS accuracy_m
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'browser', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT COALESCE(NULLIF(e.meta->'sun_context'->'client'->>'timezone', ''), 'Unknown') AS label, COUNT(*)::int AS count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
      `
      : sql/*sql*/`
        SELECT
          COUNT(*) FILTER (WHERE lower(COALESCE(e.meta->'sun_context'->'client'->>'mobile', 'false')) IN ('true','1','yes'))::int AS mobile_count,
          COUNT(*)::int AS total_count
        FROM events e
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          e.id,
          e.uid_hex,
          b.bid,
          e.event_type::text AS event_type,
          e.result,
          e.verdict,
          e.reason,
          e.cmac_ok,
          e.allowlisted,
          e.source,
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country_code,
          COALESCE(NULLIF(e.device_label, ''), NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS device,
          e.created_at::text AS created_at
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
          AND e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        ORDER BY e.created_at DESC
        LIMIT 30
      `
      : sql/*sql*/`
        SELECT
          e.id,
          e.uid_hex,
          b.bid,
          e.event_type::text AS event_type,
          e.result,
          e.verdict,
          e.reason,
          e.cmac_ok,
          e.allowlisted,
          e.source,
          COALESCE(NULLIF(e.city, ''), NULLIF(e.geo_city, ''), 'Unknown') AS city,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country_code,
          COALESCE(NULLIF(e.device_label, ''), NULLIF(e.meta->'sun_context'->'client'->>'platform', ''), 'Unknown') AS device,
          e.created_at::text AS created_at
        FROM events e
        JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        WHERE e.created_at >= now() - ${rangeSql}::interval
          AND (${source} = '' OR e.source::text = ${source})
          AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
          AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
        ORDER BY e.created_at DESC
        LIMIT 30
      `,
    tenant
      ? sql/*sql*/`
        SELECT
          t.uid_hex,
          b.bid,
          COALESCE(pp.product_name, tp.product_name, tp.sku, 'Unprofiled bottle') AS product_name,
          COALESCE(pp.winery_name, tp.winery) AS winery,
          COALESCE(pp.region, tp.region) AS region,
          COALESCE(pp.vintage, tp.vintage) AS vintage,
          operational_evt.scan_count,
          operational_evt.first_seen_at::text AS first_seen_at,
          operational_evt.last_seen_at::text AS last_seen_at,
          last_evt.city AS last_verified_city,
          last_evt.country_code AS last_verified_country,
          tok.status AS tokenization_status,
          tok.network AS tokenization_network,
          tok.tx_hash AS tokenization_tx_hash,
          tok.token_id AS tokenization_token_id,
          pp.winery_lat,
          pp.winery_lng,
          pp.winery_address,
          pp.provenance_text
        FROM tags t
        JOIN batches b ON b.id = t.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
        LEFT JOIN product_passports pp ON pp.tag_id = t.id
        JOIN LATERAL (
          SELECT
            COUNT(*)::integer AS scan_count,
            MIN(e.created_at) AS first_seen_at,
            MAX(e.created_at) AS last_seen_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.tenant_id = b.tenant_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
            AND e.created_at >= now() - ${rangeSql}::interval
        ) operational_evt ON operational_evt.scan_count > 0
        LEFT JOIN LATERAL (
          SELECT e.city, e.country_code, e.created_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.tenant_id = b.tenant_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
        ORDER BY operational_evt.last_seen_at DESC
        LIMIT 30
      `
      : sql/*sql*/`
        SELECT
          t.uid_hex,
          b.bid,
          COALESCE(pp.product_name, tp.product_name, tp.sku, 'Unprofiled bottle') AS product_name,
          COALESCE(pp.winery_name, tp.winery) AS winery,
          COALESCE(pp.region, tp.region) AS region,
          COALESCE(pp.vintage, tp.vintage) AS vintage,
          operational_evt.scan_count,
          operational_evt.first_seen_at::text AS first_seen_at,
          operational_evt.last_seen_at::text AS last_seen_at,
          last_evt.city AS last_verified_city,
          last_evt.country_code AS last_verified_country,
          tok.status AS tokenization_status,
          tok.network AS tokenization_network,
          tok.tx_hash AS tokenization_tx_hash,
          tok.token_id AS tokenization_token_id,
          pp.winery_lat,
          pp.winery_lng,
          pp.winery_address,
          pp.provenance_text
        FROM tags t
        JOIN batches b ON b.id = t.batch_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
        LEFT JOIN product_passports pp ON pp.tag_id = t.id
        JOIN LATERAL (
          SELECT
            COUNT(*)::integer AS scan_count,
            MIN(e.created_at) AS first_seen_at,
            MAX(e.created_at) AS last_seen_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.tenant_id = b.tenant_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
            AND e.created_at >= now() - ${rangeSql}::interval
        ) operational_evt ON operational_evt.scan_count > 0
        LEFT JOIN LATERAL (
          SELECT e.city, e.country_code, e.created_at
          FROM events e
          WHERE e.batch_id = t.batch_id
            AND e.tenant_id = b.tenant_id
            AND e.uid_hex = t.uid_hex
            AND (${source} = '' OR e.source::text = ${source})
            AND COALESCE(e.user_agent, '') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}
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
        ORDER BY operational_evt.last_seen_at DESC
        LIMIT 30
      `,
  ]);

  const overview = (overviewRows[0] || {
    scans: 0,
    product_recognized: 0,
    identified_unverified: 0,
    authentication_verified: 0,
    valid: 0,
    invalid: 0,
    closed: 0,
    opened: 0,
    duplicates: 0,
    tamper: 0,
    unregistered: 0,
    inactive: 0,
    active_batches: 0,
    active_tenants: 0,
  }) as Record<string, number>;

  const scansTotal = Number(overview.scans || 0);
  const productRecognized = Number(overview.product_recognized || 0);
  const identifiedUnverified = Number(overview.identified_unverified || 0);
  const authenticationVerified = Number(overview.authentication_verified || 0);
  const duplicates = Number(overview.duplicates || 0);
  const tamper = Number(overview.tamper || 0);
  const invalid = Number(overview.invalid || 0);
  const unregistered = Number(overview.unregistered || 0);
  const inactive = Number(overview.inactive || 0);
  const revoked = Number((overview as Record<string, number>).revoked || 0);
  const closed = Number(overview.closed || 0);
  const opened = Number(overview.opened || 0);
  const metrics = aggregateTenantMetrics({
    counts: {
      scans: scansTotal,
      activityTotal: scansTotal,
      recognizedProductIdentity: productRecognized,
      verifiedAuthentication: authenticationVerified,
      valid: Number(overview.valid || 0),
      invalid,
      duplicates,
      tamper,
      revoked,
    },
  });

  const trend = (trendRows as TrendRow[]).map((row) => ({
    day: row.day,
    scans: Number(row.scans || 0),
    productRecognized: Number(row.product_recognized || 0),
    identifiedUnverified: Number(row.identified_unverified || 0),
    authenticationVerified: Number(row.authentication_verified || 0),
    valid: Number(row.valid || 0),
    closed: Number(row.closed || 0),
    opened: Number(row.opened || 0),
    duplicates: Number(row.duplicates || 0),
    tamper: Number(row.tamper || 0),
    invalid: Number(row.invalid || 0),
    unregistered: Number(row.unregistered || 0),
    inactive: Number(row.inactive || 0),
  }));

  const batchMap = new Map((batchRows as Array<{ status: string; value: number }>).map((row) => [row.status, Number(row.value || 0)]));
  const batchStatus = [
    { name: "Active", value: batchMap.get("active") || 0 },
    { name: "Pending", value: batchMap.get("pending") || 0 },
    { name: "Revoked", value: batchMap.get("revoked") || 0 },
  ];

  const geoPoints = (geoRows as GeoRow[])
    .map((row) => {
      const coordinate = validCoordinatePair(row.lat, row.lng);
      if (Number(row.coordinate_count || 0) <= 0 || !coordinate) return null;
      const provenance = coordinateProvenance(row);
      return {
        city: row.city || "Unknown",
        country: row.country || "--",
        ...coordinate,
        scans: Number(row.scans || 0),
        risk: Number(row.risk || 0),
        ...provenance,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const deviceSignals = (deviceRows as DeviceRow[]).map((row) => ({
    device: row.device || "Unknown device",
    scans: Number(row.scans || 0),
    countries: Number(row.countries || 0),
    validRate: row.scans ? Number(((Number(row.valid || 0) / Number(row.scans || 1)) * 100).toFixed(1)) : 0,
    risk: Number(row.risk || 0),
  }));

  const productOriginByUid = new Map(
    (productRows as ProductRow[]).map((row) => {
      const coordinate = validCoordinatePair(row.winery_lat, row.winery_lng);
      return [String(row.uid_hex || "").toUpperCase(), {
        city: row.winery || row.region || "Product origin",
        country: row.winery_address || row.provenance_text || row.region || "--",
        lat: coordinate?.lat ?? null,
        lng: coordinate?.lng ?? null,
      }] as const;
    }),
  );

  const tagJourney = (journeyRows as JourneyRow[])
    .filter((row) => row.uid_hex)
    .map((row) => {
      const productOrigin = productOriginByUid.get(String(row.uid_hex || "").toUpperCase());
      const productOriginCoordinate = validCoordinatePair(productOrigin?.lat, productOrigin?.lng);
      const eventOriginCoordinate = validCoordinatePair(row.origin_lat, row.origin_lng);
      const currentCoordinate = validCoordinatePair(row.current_lat, row.current_lng);
      const hasProductOriginCoords = productOriginCoordinate !== null;
      return {
        uid: row.uid_hex as string,
        taps: Number(row.taps || 0),
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        origin: {
          city: hasProductOriginCoords ? productOrigin?.city || "Product origin" : row.origin_city || "Unknown",
          country: hasProductOriginCoords ? productOrigin?.country || "--" : row.origin_country || "--",
          lat: hasProductOriginCoords ? productOriginCoordinate.lat : eventOriginCoordinate?.lat ?? null,
          lng: hasProductOriginCoords ? productOriginCoordinate.lng : eventOriginCoordinate?.lng ?? null,
        },
        originSource: hasProductOriginCoords ? "product_passport_declared" : "first_observed_event",
        current: {
          city: row.current_city || "Unknown",
          country: row.current_country || "--",
          lat: currentCoordinate?.lat ?? null,
          lng: currentCoordinate?.lng ?? null,
        },
        lastDevice: row.last_device || "Unknown device",
      };
    });

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

  const recentPhysicalTaps = tenant && source === "real"
    ? await listAdminPhysicalTaps({ tenantSlug: tenant, limit: 12, rangeSql }).catch(() => ({
        availability: "unavailable" as const,
        summary: null,
        rows: [],
      }))
    : {
        availability: tenant ? "not_in_selected_source" as const : "tenant_required" as const,
        summary: null,
        rows: [],
      };

  return json({
    kpis: {
      scans: scansTotal,
      activityTotal: scansTotal,
      productRecognized,
      identifiedUnverified,
      authenticationVerified,
      messageValid: Number(overview.valid || 0),
      validRate: metrics.validRate,
      invalidRate: metrics.invalidRate,
      duplicates,
      tamper,
      unregistered,
      inactive,
      closedTaps: closed,
      openedTaps: opened,
      activeBatches: Number(overview.active_batches || 0),
      activeTenants: Number(overview.active_tenants || 0),
      geoRegions: geoPoints.length,
      resellerPerformance: null,
      resellerPerformanceSource: "billing_unavailable",
      riskScore: metrics.riskScore,
    },
    scope: {
      tenant: tenant || "global",
      source: source || "all",
      range,
      country: country || "all",
    },
    riskBreakdown: metrics.riskBreakdown,
    eventTaxonomy: {
      version: EVENT_TAXONOMY_VERSION,
      definitions: {
        valid: "authenticated_message_or_policy_validation_passed_independent_of_seal_state",
        identifiedUnverified: "authoritative_product_identity_without_physical_or_cryptographic_authentication",
        productRecognized: "authoritative_batch_or_unit_binding_independent_of_security_verdict",
        authenticationVerified: "tap_valid_with_cmac_and_allowlist",
        closed: "authenticated_message_with_reported_closed_tt_state",
        opened: "authenticated_message_with_reported_opened_tt_state",
        invalid: "validation_failed",
        duplicate: "replay_or_duplicate_signal",
        tamper: "explicit_tamper_signal_only",
        unregistered: "tag_uid_not_registered",
        inactive: "tag_or_batch_not_active",
        revoked: "tag_or_credential_revoked",
      },
      securityRiskClasses: ["invalid", "duplicate", "tamper", "revoked"],
      neutralIdentityClassesExcludedFromRisk: ["identified_unverified"],
      lifecycleClassesExcludedFromRisk: ["unregistered", "inactive"],
      counts: {
        activityTotal: scansTotal,
        productRecognized,
        identifiedUnverified,
        authenticationVerified,
        valid: Number(overview.valid || 0),
        closed,
        opened,
        invalid,
        duplicate: duplicates,
        tamper,
        unregistered,
        inactive,
        revoked,
      },
    },
    geography: {
      countries: (countryRows as CountryRow[]).map((row) => ({
        country: row.country || "--",
        scans: Number(row.scans || 0),
        risk: Number(row.risk || 0),
      })),
      cities: (cityRows as CityRow[]).map((row) => {
        const coordinate = validCoordinatePair(row.lat, row.lng);
        return {
          city: row.city || "Unknown",
          country: row.country || "--",
          lat: coordinate?.lat ?? null,
          lng: coordinate?.lng ?? null,
          scans: Number(row.scans || 0),
          risk: Number(row.risk || 0),
          lastSeen: row.last_seen,
          ...coordinateProvenance(row),
        };
      }),
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
      messageValid: isAuthenticatedNfcMessage({
        eventType: row.event_type,
        result: row.result,
        verdict: row.verdict,
        reason: row.reason,
        cmacOk: row.cmac_ok,
        allowlisted: row.allowlisted,
      }),
      sealState: classifyPhysicalTapSealState(row.result),
      source: row.source || "unknown",
      city: row.city || "Unknown",
      country: row.country_code || "--",
      device: row.device || "Unknown",
      createdAt: row.created_at,
    })),
    products: (productRows as ProductRow[]).map((row) => {
      const originCoordinate = validCoordinatePair(row.winery_lat, row.winery_lng);
      return {
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
        origin: {
          city: row.winery || row.region || null,
          label: row.winery_address || row.provenance_text || row.region || null,
          lat: originCoordinate?.lat ?? null,
          lng: originCoordinate?.lng ?? null,
        },
      };
    }),
    trend,
    batchStatus,
    geoPoints,
    deviceSignals,
    tagJourney,
    recentPhysicalTaps,
  });
}
