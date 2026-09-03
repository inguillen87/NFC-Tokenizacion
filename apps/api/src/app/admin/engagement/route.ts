export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantAccess } from "../../../lib/auth";
import { json } from "../../../lib/http";
import {
  loadTenantEngagement,
  normalizeTenantEngagementSlug,
  parseTenantEngagementFilters,
  resolveTenantEngagementScope,
  summarizeTenantEngagement,
} from "../../../lib/tenant-engagement";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;

  const url = new URL(req.url);
  const requestedTenant = url.searchParams.get("tenant") || url.searchParams.get("tenantSlug") || "";
  const access = getAdminTenantAccess(req, requestedTenant);
  if (!access.effectiveTenantSlug) {
    return json({ ok: false, reason: "tenant_required" }, 400, NO_STORE);
  }
  const tenantSlug = normalizeTenantEngagementSlug(access.effectiveTenantSlug);
  if (!tenantSlug) {
    return json({ ok: false, reason: "tenant_invalid" }, 400, NO_STORE);
  }

  const parsed = parseTenantEngagementFilters(url.searchParams);
  if (!parsed.ok) return json({ ok: false, reason: parsed.reason }, 400, NO_STORE);

  try {
    const tenant = await resolveTenantEngagementScope(tenantSlug);
    if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);

    const projection = await loadTenantEngagement({ tenant, filters: parsed.filters });
    return json({
      ok: true,
      scope: {
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        range: parsed.filters.range,
        domain: parsed.filters.domain || "all",
        stage: parsed.filters.stage || "all",
        source: parsed.filters.dataMode || "all",
        limit: parsed.filters.limit,
      },
      taxonomy: projection.taxonomy,
      totals: {
        matched: projection.total,
        returned: projection.items.length,
        truncated: projection.truncated,
      },
      summary: summarizeTenantEngagement(projection.items),
      items: projection.items,
      boundaries: {
        actor: "A UID, tag or tap is never treated as a person. A consumerId is returned only for one durable consumer link with a current explicit contact consent.",
        source: "real, demo, imported and unknown records remain separated; missing evidence stays unknown.",
        confirmed: projection.taxonomy.confirmedMeaning,
      },
    }, 200, NO_STORE);
  } catch (error) {
    console.error("[admin_engagement] projection unavailable", {
      tenantSlug,
      error: error instanceof Error ? error.name : "unknown_error",
    });
    return json({
      ok: false,
      reason: "tenant_engagement_unavailable",
      retryable: true,
    }, 503, { ...NO_STORE, "retry-after": "2" });
  }
}
