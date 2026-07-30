export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdmin,
  checkAdminPermission,
  getAdminPrincipal,
  getAdminTenantAccess,
} from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import {
  adminCriticalRateLimitIdentity,
  enforceCriticalRateLimit,
} from "../../../../lib/critical-rate-limit";
import {
  getCachedServiceLevelSnapshot,
  resolveServiceLevelTenantId,
  resolveServiceLevelWindow,
} from "../../../../lib/service-level-observability";

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function safeRouteFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "required_schema_migration_not_applied") return "schema_watermark_unavailable";
  if (message === "DATABASE_URL is not set") return "database_unavailable";
  return "service_levels_unavailable";
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "analytics:read");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "observability_read",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (rateLimited) return rateLimited;

  const principal = getAdminPrincipal(req);
  const url = new URL(req.url);
  const requestedTenant = String(url.searchParams.get("tenant") || "").trim().toLowerCase();
  const access = getAdminTenantAccess(req, requestedTenant);
  const tenantSlug = access.effectiveTenantSlug;
  const window = resolveServiceLevelWindow(url.searchParams.get("window"));
  const requestId = req.headers.get("x-request-id") || req.headers.get("x-vercel-id") || null;

  console.info(JSON.stringify({
    level: "info",
    message: "service_levels_snapshot_started",
    route: "/admin/observability/service-levels",
    requestId,
    scope: tenantSlug ? "tenant" : "global",
    window,
  }));

  if (tenantSlug && !TENANT_SLUG_PATTERN.test(tenantSlug)) {
    return json({ ok: false, reason: "tenant_scope_invalid" }, 400, { "cache-control": "no-store" });
  }

  try {
    let tenantId = access.tenantBound ? principal.tenantId : null;
    if (tenantSlug && !tenantId) {
      tenantId = await resolveServiceLevelTenantId(tenantSlug);
      if (!tenantId) return json({ ok: false, reason: "tenant_not_found" }, 404, { "cache-control": "no-store" });
    }

    const snapshot = await getCachedServiceLevelSnapshot({ tenantId, window });
    console.info(JSON.stringify({
      level: "info",
      message: "service_levels_snapshot_completed",
      route: "/admin/observability/service-levels",
      requestId,
      scope: tenantId ? "tenant" : "global",
      window,
      unavailableServices: snapshot.services.filter((service) => service.availability === "unavailable").length,
      activeAlerts: snapshot.alerts.length,
      durationMs: Date.now() - startedAt,
    }));
    return json(snapshot, 200, {
      "cache-control": "private, no-store, max-age=0",
      "x-nexid-data-mode": "production",
    });
  } catch (error) {
    const reason = safeRouteFailure(error);
    console.error(JSON.stringify({
      level: "error",
      message: "service_levels_snapshot_failed",
      route: "/admin/observability/service-levels",
      requestId,
      reason,
      durationMs: Date.now() - startedAt,
    }));
    return json({ ok: false, reason }, 503, { "cache-control": "no-store" });
  }
}
