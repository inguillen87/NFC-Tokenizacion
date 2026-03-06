export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

type TrendRow = { day: string; scans: number; duplicates: number; tamper: number };

type GeoRow = {
  tenant_slug: string;
  events: number;
  duplicates: number;
  tamper: number;
};

const geoBySlug: Array<{ match: RegExp; city: string; country: string; lat: number; lng: number }> = [
  { match: /andes|vino|mza|malbec/i, city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
  { match: /sao|br|brazil/i, city: "São Paulo", country: "BR", lat: -23.5558, lng: -46.6396 },
  { match: /pharma|scl|chile/i, city: "Santiago", country: "CL", lat: -33.4489, lng: -70.6693 },
  { match: /event|vip|festival/i, city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
  { match: /eu|london|uk/i, city: "London", country: "UK", lat: 51.5072, lng: -0.1276 },
  { match: /us|ny|miami/i, city: "New York", country: "US", lat: 40.7128, lng: -74.006 },
];

function resolveGeo(slug: string) {
  const found = geoBySlug.find((item) => item.match.test(slug));
  return found || { city: "Global", country: "--", lat: 0, lng: 0 };
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const [overviewRows, trendRows, batchRows, geoRows] = await Promise.all([
    tenant
      ? sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS scans,
          COUNT(*) FILTER (WHERE e.result = 'valid')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'invalid')::int AS invalid,
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper,
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
          COUNT(*) FILTER (WHERE e.result = 'valid')::int AS valid,
          COUNT(*) FILTER (WHERE e.result = 'invalid')::int AS invalid,
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper,
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
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper
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
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper
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
        SELECT tn.slug AS tenant_slug,
          COUNT(e.id)::int AS events,
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        WHERE tn.slug = ${tenant}
        GROUP BY tn.slug
        ORDER BY events DESC
        LIMIT 8
      `
      : sql/*sql*/`
        SELECT tn.slug AS tenant_slug,
          COUNT(e.id)::int AS events,
          COUNT(*) FILTER (WHERE e.result = 'duplicate')::int AS duplicates,
          COUNT(*) FILTER (WHERE e.result = 'tamper')::int AS tamper
        FROM events e
        JOIN tenants tn ON tn.id = e.tenant_id
        GROUP BY tn.slug
        ORDER BY events DESC
        LIMIT 8
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

  const geoPoints = (geoRows as GeoRow[]).map((row) => {
    const g = resolveGeo(row.tenant_slug);
    return {
      tenant: row.tenant_slug,
      city: g.city,
      country: g.country,
      lat: g.lat,
      lng: g.lng,
      scans: Number(row.events || 0),
      risk: Number((row.duplicates || 0) + (row.tamper || 0)),
    };
  });

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
  });
}
