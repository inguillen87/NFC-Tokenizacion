export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get('tenant') || 'demobodega';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 100);

  const rows = await sql/*sql*/`
    SELECT
      e.id,
      e.created_at,
      e.result,
      e.uid_hex,
      e.device_label,
      COALESCE(e.city, e.geo_city) AS city,
      COALESCE(e.country_code, e.geo_country) AS country_code,
      COALESCE(e.lat, e.geo_lat) AS lat,
      COALESCE(e.lng, e.geo_lng) AS lng,
      e.source,
      b.bid,
      tn.slug AS tenant_slug,
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
    WHERE tn.slug = ${tenant}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `;

  return json({ ok: true, tenant, items: rows });
}
