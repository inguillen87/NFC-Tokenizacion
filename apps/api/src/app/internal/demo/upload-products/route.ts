export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as any));
  const bid = String(body.bid || 'DEMO-2026-02');
  const raw = body.products ?? body;
  const products = Array.isArray(raw) ? raw : Array.isArray(raw.products) ? raw.products : Array.isArray(raw.bottles) ? raw.bottles : [];

  const batch = (await sql`SELECT id FROM batches WHERE bid=${bid} LIMIT 1`)[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  let updated = 0;
  for (const item of products) {
    const uidHex = String(item.uidHex || item.uid_hex || '').toUpperCase();
    if (!uidHex) continue;
    const tag = (await sql`SELECT id FROM tags WHERE batch_id=${batch.id} AND uid_hex=${uidHex} LIMIT 1`)[0];
    if (!tag) continue;

    await sql`INSERT INTO tag_profiles (tag_id, sku, product_name, vintage, grape_varietal, alcohol_pct, barrel_months, harvest_year, vineyard_humidity, soil_humidity, region, winery, temperature_storage, notes, locale_data)
    VALUES (${tag.id}, ${item.sku || null}, ${item.productName || null}, ${item.vintage || null}, ${item.grapeVarietal || null}, ${item.alcoholPct || null}, ${item.barrelMonths || null}, ${item.harvestYear || null}, ${item.vineyardHumidity || null}, ${item.soilHumidity || null}, ${item.region || null}, 'Demo Bodega', ${item.temperatureStorage || null}, ${item.notes || null}, ${JSON.stringify({ 'es-AR': item, 'pt-BR': item, en: item })}::jsonb)
    ON CONFLICT (tag_id) DO UPDATE SET sku=EXCLUDED.sku, product_name=EXCLUDED.product_name, locale_data=EXCLUDED.locale_data, updated_at=now()`;
    updated += 1;
  }

  return json({ ok: true, updated });
}
