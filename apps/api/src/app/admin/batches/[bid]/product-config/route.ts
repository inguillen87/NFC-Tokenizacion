export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";

type ProductConfigBody = {
  product_name?: string | null;
  sku?: string | null;
  winery?: string | null;
  region?: string | null;
  grape_varietal?: string | null;
  vintage?: string | null;
  harvest_year?: number | null;
  barrel_months?: number | null;
  temperature_storage?: string | null;
  image_url?: string | null;
  target_country?: string | null;
  target_market?: string | null;
};

export async function PATCH(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await context.params;
  const body = (await req.json().catch(() => ({}))) as ProductConfigBody;
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const nextConfig: Record<string, unknown> = {};

  if (body.product_name !== undefined) nextConfig.product_name = body.product_name ? String(body.product_name).trim() : null;
  if (body.sku !== undefined) nextConfig.sku = body.sku ? String(body.sku).trim() : null;
  if (body.winery !== undefined) nextConfig.winery = body.winery ? String(body.winery).trim() : null;
  if (body.region !== undefined) nextConfig.region = body.region ? String(body.region).trim() : null;
  if (body.grape_varietal !== undefined) nextConfig.grape_varietal = body.grape_varietal ? String(body.grape_varietal).trim() : null;
  if (body.vintage !== undefined) nextConfig.vintage = body.vintage ? String(body.vintage).trim() : null;
  
  if (body.harvest_year !== undefined) {
    nextConfig.harvest_year = body.harvest_year != null ? Math.max(0, Math.trunc(Number(body.harvest_year))) : null;
  }
  if (body.barrel_months !== undefined) {
    nextConfig.barrel_months = body.barrel_months != null ? Math.max(0, Math.trunc(Number(body.barrel_months))) : null;
  }
  if (body.temperature_storage !== undefined) nextConfig.temperature_storage = body.temperature_storage ? String(body.temperature_storage).trim() : null;
  if (body.image_url !== undefined) nextConfig.image_url = body.image_url ? String(body.image_url).trim() : null;
  
  // Set target export country / market
  const targetCountry = body.target_country || body.target_market;
  if (targetCountry !== undefined) {
    nextConfig.target_country = targetCountry ? String(targetCountry).trim().toUpperCase() : null;
    nextConfig.target_market = targetCountry ? String(targetCountry).trim().toUpperCase() : null;
  }

  const batches = await sql/*sql*/`
    SELECT id, status, created_at
    FROM batches
    WHERE bid = ${bid}
    ORDER BY created_at ASC, id ASC
  `;
  if (!batches[0]) return json({ ok: false, reason: "batch not found" }, 404);
  if (batches.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before updating product config.",
      batches: batches.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }

  const updated = await sql/*sql*/`
    UPDATE batches
    SET sdm_config = COALESCE(sdm_config, '{}'::jsonb) || ${JSON.stringify(nextConfig)}::jsonb
    WHERE id = ${batches[0].id}
    RETURNING id, bid, sdm_config
  `;

  return json({ ok: true, bid: updated[0].bid, sdm_config: updated[0].sdm_config });
}
