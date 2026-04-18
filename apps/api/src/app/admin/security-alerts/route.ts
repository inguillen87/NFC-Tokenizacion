export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
  const range = Number(searchParams.get("hours") || 24);
  const windowHours = Math.min(Math.max(range, 1), 168);

  const invalidRows = tenant
    ? await sql/*sql*/`
      SELECT e.uid_hex, COUNT(*)::int AS invalid_count, MAX(e.created_at)::text AS last_seen
      FROM events e
      JOIN batches b ON b.id = e.batch_id
      JOIN tenants t ON t.id = b.tenant_id
      WHERE t.slug = ${tenant}
        AND e.created_at >= now() - (${windowHours} || ' hours')::interval
        AND UPPER(e.result) <> 'VALID'
      GROUP BY e.uid_hex
      HAVING COUNT(*) >= 2
      ORDER BY invalid_count DESC, last_seen DESC
      LIMIT 50
    `
    : await sql/*sql*/`
      SELECT e.uid_hex, COUNT(*)::int AS invalid_count, MAX(e.created_at)::text AS last_seen
      FROM events e
      WHERE e.created_at >= now() - (${windowHours} || ' hours')::interval
        AND UPPER(e.result) <> 'VALID'
      GROUP BY e.uid_hex
      HAVING COUNT(*) >= 2
      ORDER BY invalid_count DESC, last_seen DESC
      LIMIT 50
    `;

  const geoRows = tenant
    ? await sql/*sql*/`
      WITH scoped AS (
        SELECT e.uid_hex, COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country, e.created_at
        FROM events e
        JOIN batches b ON b.id = e.batch_id
        JOIN tenants t ON t.id = b.tenant_id
        WHERE t.slug = ${tenant}
          AND e.created_at >= now() - (${windowHours} || ' hours')::interval
      ),
      ordered AS (
        SELECT
          uid_hex,
          country,
          created_at,
          LAG(country) OVER (PARTITION BY uid_hex ORDER BY created_at) AS prev_country,
          LAG(created_at) OVER (PARTITION BY uid_hex ORDER BY created_at) AS prev_created_at
        FROM scoped
      )
      SELECT uid_hex, prev_country, country, prev_created_at::text AS prev_at, created_at::text AS at
      FROM ordered
      WHERE prev_country IS NOT NULL
        AND country IS NOT NULL
        AND prev_country <> country
        AND created_at - prev_created_at <= interval '1 hour'
      ORDER BY created_at DESC
      LIMIT 50
    `
    : await sql/*sql*/`
      WITH ordered AS (
        SELECT
          e.uid_hex,
          COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--') AS country,
          e.created_at,
          LAG(COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, ''), '--')) OVER (PARTITION BY e.uid_hex ORDER BY e.created_at) AS prev_country,
          LAG(e.created_at) OVER (PARTITION BY e.uid_hex ORDER BY e.created_at) AS prev_created_at
        FROM events e
        WHERE e.created_at >= now() - (${windowHours} || ' hours')::interval
      )
      SELECT uid_hex, prev_country, country, prev_created_at::text AS prev_at, created_at::text AS at
      FROM ordered
      WHERE prev_country IS NOT NULL
        AND country IS NOT NULL
        AND prev_country <> country
        AND created_at - prev_created_at <= interval '1 hour'
      ORDER BY created_at DESC
      LIMIT 50
    `;

  return json({
    ok: true,
    scope: { tenant: tenant || "global", hours: windowHours },
    summary: {
      repeatedInvalidUid: invalidRows.length,
      geoVelocityAlerts: geoRows.length,
    },
    repeatedInvalidUid: invalidRows.map((row) => ({
      uidHex: String(row.uid_hex || ""),
      count: Number(row.invalid_count || 0),
      lastSeen: String(row.last_seen || ""),
      severity: Number(row.invalid_count || 0) >= 5 ? "critical" : "high",
    })),
    geoVelocityAlerts: geoRows.map((row) => ({
      uidHex: String(row.uid_hex || ""),
      fromCountry: String(row.prev_country || "--"),
      toCountry: String(row.country || "--"),
      fromAt: String(row.prev_at || ""),
      toAt: String(row.at || ""),
      severity: "critical",
    })),
  });
}
