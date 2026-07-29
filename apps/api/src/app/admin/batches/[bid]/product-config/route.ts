export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantAccess } from "../../../../../lib/auth";
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
  altitude?: string | null;
  oak_type?: string | null;
  alcohol?: string | null;
  bottle?: string | null;
  serving?: string | null;
  notes?: string | null;
  tasting_notes?: string | null;
  maridaje?: string | null;
  simulated_temp_c?: number | null;
  simulated_humidity_pct?: number | null;
  simulated_light?: string | null;
  simulated_shock?: string | null;
};

export async function PATCH(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { bid } = await context.params;
  const body = (await req.json().catch(() => ({}))) as ProductConfigBody;
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const { forcedTenantSlug } = getAdminTenantAccess(req);
  const batches = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.status, b.created_at, b.sdm_config
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, status, created_at, sdm_config
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

  const existingConfig = (batches[0].sdm_config && typeof batches[0].sdm_config === "object")
    ? (batches[0].sdm_config as Record<string, any>)
    : {};

  const nextConfig = { ...existingConfig };

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
  
  const targetCountry = body.target_country || body.target_market;
  if (targetCountry !== undefined) {
    nextConfig.target_country = targetCountry ? String(targetCountry).trim().toUpperCase() : null;
    nextConfig.target_market = targetCountry ? String(targetCountry).trim().toUpperCase() : null;
  }

  // Nested structures mapping
  if (!nextConfig.sun) nextConfig.sun = {};
  if (!nextConfig.sun.product) nextConfig.sun.product = {};
  if (!nextConfig.sun.origin) nextConfig.sun.origin = {};
  if (!nextConfig.sun.telemetry) nextConfig.sun.telemetry = {};

  if (body.altitude !== undefined) nextConfig.sun.origin.altitude = body.altitude ? String(body.altitude).trim() : null;
  if (body.oak_type !== undefined) nextConfig.sun.product.oakType = body.oak_type ? String(body.oak_type).trim() : null;
  if (body.alcohol !== undefined) nextConfig.sun.product.alcohol = body.alcohol ? String(body.alcohol).trim() : null;
  if (body.bottle !== undefined) nextConfig.sun.product.bottle = body.bottle ? String(body.bottle).trim() : null;
  if (body.serving !== undefined) nextConfig.sun.product.serving = body.serving ? String(body.serving).trim() : null;
  
  if (body.notes !== undefined || body.tasting_notes !== undefined) {
    const val = body.notes || body.tasting_notes;
    nextConfig.sun.product.notes = val ? String(val).trim() : null;
    nextConfig.sun.product.tasting_notes = val ? String(val).trim() : null;
  }
  if (body.maridaje !== undefined) nextConfig.sun.product.maridaje = body.maridaje ? String(body.maridaje).trim() : null;

  if (body.simulated_temp_c !== undefined) {
    nextConfig.sun.telemetry.simulatedTempC = body.simulated_temp_c != null ? Number(body.simulated_temp_c) : null;
    nextConfig.sun.product.simulatedTempC = body.simulated_temp_c != null ? Number(body.simulated_temp_c) : null;
  }
  if (body.simulated_humidity_pct !== undefined) {
    nextConfig.sun.telemetry.simulatedHumidityPct = body.simulated_humidity_pct != null ? Number(body.simulated_humidity_pct) : null;
    nextConfig.sun.product.simulatedHumidityPct = body.simulated_humidity_pct != null ? Number(body.simulated_humidity_pct) : null;
  }
  if (body.simulated_light !== undefined) {
    nextConfig.sun.telemetry.simulatedLight = body.simulated_light ? String(body.simulated_light).trim() : null;
    nextConfig.sun.product.simulatedLight = body.simulated_light ? String(body.simulated_light).trim() : null;
  }
  if (body.simulated_shock !== undefined) {
    nextConfig.sun.telemetry.simulatedShock = body.simulated_shock ? String(body.simulated_shock).trim() : null;
    nextConfig.sun.product.simulatedShock = body.simulated_shock ? String(body.simulated_shock).trim() : null;
  }

  const updated = await sql/*sql*/`
    UPDATE batches
    SET sdm_config = ${JSON.stringify(nextConfig)}::jsonb
    WHERE id = ${batches[0].id}
    RETURNING id, bid, sdm_config
  `;

  return json({ ok: true, bid: updated[0].bid, sdm_config: updated[0].sdm_config });
}
