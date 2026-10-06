import TenantMarketplaceWorkspace from "../../../../components/tenant-marketplace-workspace";
import { createAdminPageContext } from "../../../../lib/admin-page-access";
import { dashboardFetch } from "../../../../lib/dashboard-fetch";
import { dashboardPermissionDenied, dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { requireDashboardSession } from "../../../../lib/session";
import { parseTenantCatalog, type TenantCatalog } from "../../../../lib/tenant-marketplace";

export default async function MarketplacePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("marketplace:read");
  const context = await createAdminPageContext(session, query.tenant);
  let initialData: TenantCatalog | null = null, initialReason = "";
  if (context.tenantSlug && !session.isDemo) {
    try {
      const url = new URL("/api/tenant-marketplace", context.origin);
      url.searchParams.set("tenant", context.tenantSlug);
      const response = await dashboardFetch(url, { cache: "no-store", headers: { cookie: context.cookie } });
      const body = await response.json().catch(() => null);
      initialData = response.ok ? parseTenantCatalog(body, context.tenantSlug) : null;
      if (!initialData) initialReason = response.status === 403 ? "catalog_forbidden" : typeof body?.reason === "string" ? body.reason : "catalog_unavailable";
    } catch { initialReason = "catalog_unavailable"; }
  }
  const canWrite = Boolean(context.tenantSlug && !session.isDemo) && ["super-admin", "tenant-owner", "tenant-admin"].includes(session.role)
    && (session.role === "super-admin" ? !dashboardPermissionDenied(session.deniedPermissions, "marketplace:write")
      : dashboardPermissionMatches(session.permissions, "marketplace:write", session.deniedPermissions));
  return <TenantMarketplaceWorkspace key={`${context.tenantSlug}:${Boolean(session.isDemo)}`} tenant={context.tenantSlug} canWrite={canWrite}
    canSelectTenant={context.canSelectTenant} initialData={initialData} initialReason={initialReason} isDemo={Boolean(session.isDemo)} />;
}
