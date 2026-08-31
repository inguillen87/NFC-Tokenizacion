export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminPermission, checkAdminWithPermission, getAdminTenantAccess } from "../../../../lib/auth";
import { listAdminPhysicalTaps } from "../../../../lib/admin-physical-taps";
import { json } from "../../../../lib/http";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "analytics:read");
  if (auth) return auth;
  const sensitive = checkAdminPermission(req, "events.read_sensitive");
  if (sensitive) return sensitive;

  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenant");
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);
  if (!tenant) return json({ ok: false, reason: "physical_taps_tenant_required" }, 400, NO_STORE);

  const bid = String(searchParams.get("bid") || "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 100);
  const range = String(searchParams.get("range") || "30d").trim().toLowerCase();
  const rangeSql = range === "24h" ? "24 hours" : range === "7d" ? "7 days" : range === "90d" ? "90 days" : "30 days";

  try {
    const physicalTaps = await listAdminPhysicalTaps({ tenantSlug: tenant, bid, limit, rangeSql });
    return json({
      ok: true,
      scope: {
        tenant,
        bid: bid || "all",
        source: "real",
        range: range === "24h" || range === "7d" || range === "90d" ? range : "30d",
        limit,
      },
      ...physicalTaps,
    }, 200, NO_STORE);
  } catch (error) {
    console.error("[admin_physical_taps_unavailable]", JSON.stringify({
      tenant,
      bid: bid || null,
      reason: error instanceof Error ? error.message : "physical_taps_unavailable",
    }));
    return json({ ok: false, reason: "physical_taps_unavailable" }, 503, NO_STORE);
  }
}
