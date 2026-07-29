export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { effectiveTenantFilter } from "../../../../lib/admin-tenant-filter";
import { ensureDefaultLoyaltyProgram } from "../../../../lib/loyalty-schema";

const ALLOWED_TYPES = [
  "DISCOUNT",
  "EXPERIENCE",
  "TASTING",
  "TOUR",
  "FREE_SHIPPING",
  "EARLY_ACCESS",
  "DIGITAL_COLLECTIBLE",
  "CONTENT_UNLOCK",
  "GIFT",
  "SERVICE",
  "WARRANTY_EXTENSION",
  "REFILL",
  "VIP_ACCESS",
  "WINE_BOTTLE",
  "WINE_BOX"
];

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || "";

  const rows = tenant
    ? await sql`
        SELECT r.code, r.title, r.points_cost as points, r.status, r.description, r.type, r.image_url, r.stock_total, r.stock_remaining
        FROM rewards r
        JOIN tenants t ON t.id = r.tenant_id
        WHERE t.slug = ${tenant}
        ORDER BY r.created_at DESC
      `
    : await sql`
        SELECT r.code, r.title, r.points_cost as points, r.status, r.description, r.type, r.image_url, r.stock_total, r.stock_remaining
        FROM rewards r
        ORDER BY r.created_at DESC
      `;

  return json({ ok: true, rewards: rows });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const tenantSlug = effectiveTenantFilter({
    forcedTenantSlug,
    requestedTenantSlug: String(body.tenant_slug || body.tenant || "")
  });

  if (!tenantSlug) {
    return json({ ok: false, error: "tenant_required" }, 400);
  }

  const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  if (!tenantRows.length) {
    return json({ ok: false, error: "tenant_not_found" }, 400);
  }
  const tenantId = tenantRows[0].id;

  // Ensure loyalty program is active
  const program = await ensureDefaultLoyaltyProgram({ tenantId, tenantSlug });
  if (!program) {
    return json({ ok: false, error: "loyalty_program_not_found" }, 400);
  }
  const programId = program.id;

  const code = String(body.code || "").trim().toUpperCase();
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const type = String(body.type || "EXPERIENCE").trim().toUpperCase();
  const pointsCost = Math.max(0, parseInt(body.points_cost || body.points || "0", 10));
  const stockTotal = body.stock_total !== undefined ? parseInt(body.stock_total, 10) : 100;
  const stockRemaining = body.stock_remaining !== undefined ? parseInt(body.stock_remaining, 10) : stockTotal;
  const imageUrl = String(body.image_url || "").trim();
  const requiresAgeGate = !!body.requires_age_gate;
  const networkVisible = body.network_visible !== false;
  const status = String(body.status || "active").trim().toLowerCase();

  if (!code) {
    return json({ ok: false, error: "code_required" }, 400);
  }
  if (!title) {
    return json({ ok: false, error: "title_required" }, 400);
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return json({ ok: false, error: `invalid_reward_type. Allowed: ${ALLOWED_TYPES.join(", ")}` }, 400);
  }

  try {
    const rows = await sql`
      INSERT INTO rewards (
        tenant_id, program_id, code, title, description, type, status,
        points_cost, stock_total, stock_remaining, image_url,
        requires_age_gate, network_visible
      )
      VALUES (
        ${tenantId}, ${programId}, ${code}, ${title}, ${description}, ${type}::reward_type, ${status},
        ${pointsCost}, ${stockTotal}, ${stockRemaining}, ${imageUrl || null},
        ${requiresAgeGate}, ${networkVisible}
      )
      ON CONFLICT (program_id, code)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        points_cost = EXCLUDED.points_cost,
        stock_total = EXCLUDED.stock_total,
        stock_remaining = EXCLUDED.stock_remaining,
        image_url = EXCLUDED.image_url,
        requires_age_gate = EXCLUDED.requires_age_gate,
        network_visible = EXCLUDED.network_visible,
        updated_at = now()
      RETURNING *
    `;
    return json({ ok: true, reward: rows[0] });
  } catch (err: any) {
    return json({ ok: false, error: "database_error", details: err.message }, 500);
  }
}
