export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

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

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const [overviewRows, trendRows, batchRows, geoRows, deviceRows, journeyRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(DISTINCT b.id)::int AS active_batches,
          COUNT(DISTINCT tn.id)::int AS active_tenants
        FROM tenants tn
        LEFT JOIN batches b ON b.tenant_id = tn.id
        LEFT JOIN events e ON e.batch_id = b.id
        WHERE tn.slug = ${tenant}
      `
      : sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result = 'VALID')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'INVALID')::int AS invalid,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active')::int AS active_batches,
          COUNT(DISTINCT tn.id)::int AS active_tenants
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        LEFT JOIN events e ON e.batch_id = b.id
      `,
    tenant
      ? sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant} AND e.created_at >= now() - interval '6 days'
        GROUP BY 1
        ORDER BY min(e.created_at)
      `
      : sql/*sql*/`
        SELECT to_char(date_trunc('day', e.created_at), 'Dy') AS day,
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE'))::int AS tamper
        FROM events e
        WHERE e.created_at >= now() - interval '6 days'
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
        WHERE tn.slug = ${tenant} AND e.geo_lat IS NOT NULL AND e.geo_lng IS NOT NULL
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
        WHERE e.geo_lat IS NOT NULL AND e.geo_lng IS NOT NULL
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
          WHERE tn.slug = ${tenant} AND e.uid_hex IS NOT NULL
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

  const overview = (overviewRows[0] || {
    scans: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    tamper: 0,
    active_batches: 0,
    active_tenants: 0,
  }) as Record<string, number>;

  const validRate = overview.scans ? Number(((overview.valid / overview.scans) * 100).toFixed(1)) : 0;
  const invalidRate = overview.scans ? Number(((overview.invalid / overview.scans) * 100).toFixed(1)) : 0;

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

  return json({
    kpis: {
      scans: Number(overview.scans || 0),
      validRate,
      invalidRate,
      duplicates: Number(overview.duplicates || 0),
      tamper: Number(overview.tamper || 0),
      activeBatches: Number(overview.active_batches || 0),
      activeTenants: Number(overview.active_tenants || 0),
      geoRegions: geoPoints.length,
      resellerPerformance: Number((overview.scans || 0) * 1.8),
    },
    trend,
    batchStatus,
    geoPoints,
    deviceSignals,
    tagJourney,
  });
}
