export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { enforceCriticalRateLimit } from '../../../lib/critical-rate-limit';
import {
  DEMO_TENANT_SLUG,
  requireReservedDemoBatch,
} from '../../../lib/demo-resource-scope';

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isSafeInteger(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 50);
}

export async function GET(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: 'public',
    tenantId: 'platform',
    subjectId: 'public-demo-live-feed',
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const requestedTenant = String(searchParams.get('tenant') || DEMO_TENANT_SLUG).trim().toLowerCase();
  if (requestedTenant !== DEMO_TENANT_SLUG) {
    return json({ ok: false, reason: 'public_demo_not_found' }, 404, { 'cache-control': 'no-store' });
  }

  const batchScope = await requireReservedDemoBatch();
  if (!batchScope.ok) {
    return json({ ok: false, reason: 'public_demo_unavailable' }, 503, { 'cache-control': 'no-store' });
  }

  const limit = parseLimit(searchParams.get('limit'));

  const rows = await sql/*sql*/`
    SELECT
      e.id,
      e.created_at,
      e.result,
      CASE
        WHEN length(COALESCE(e.uid_hex, '')) >= 8
          THEN left(e.uid_hex, 4) || '****' || right(e.uid_hex, 4)
        ELSE NULL
      END AS uid_masked,
      COALESCE(e.city, e.geo_city) AS city,
      COALESCE(e.country_code, e.geo_country) AS country_code,
      round(COALESCE(e.lat, e.geo_lat)::numeric, 2)::double precision AS lat,
      round(COALESCE(e.lng, e.geo_lng)::numeric, 2)::double precision AS lng,
      'synthetic_demo'::text AS source,
      tp.sku,
      tp.product_name,
      tp.region,
      tp.winery,
      tp.grape_varietal,
      tp.alcohol_pct,
      tp.harvest_year,
      tp.temperature_storage,
      tp.vintage,
      tp.barrel_months,
      COALESCE(tp.locale_data->>'vertical', 'wine') AS vertical
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN tags t ON t.batch_id = b.id AND t.uid_hex = e.uid_hex
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    WHERE b.id = ${batchScope.batch.id}
      AND b.tenant_id = ${batchScope.batch.tenantId}
      AND tn.slug = ${DEMO_TENANT_SLUG}
      AND LOWER(COALESCE(e.source::text, '')) = 'demo'
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `;

  return json({
    ok: true,
    tenant: DEMO_TENANT_SLUG,
    source: 'synthetic_demo_only',
    locationPrecision: 'approximate_2_decimals',
    items: rows,
  }, 200, {
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  });
}
