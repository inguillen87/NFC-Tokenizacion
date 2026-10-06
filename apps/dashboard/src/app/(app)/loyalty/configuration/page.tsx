import LoyaltyConfigurationWorkspace from "../../../../components/loyalty-configuration-workspace";
import { createAdminPageContext, fetchAdminPage } from "../../../../lib/admin-page-access";
import { parseLoyaltyConfiguration } from "../../../../lib/loyalty-configuration";
import { dashboardPermissionDenied, dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { requireDashboardSession } from "../../../../lib/session";

export default async function LoyaltyConfigurationPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("rewards:read");
  const context = await createAdminPageContext(session, query.tenant);
  let initialData = null;
  let initialReason = "";
  if (context.tenantSlug && !session.isDemo) {
    try {
      const response = await fetchAdminPage(context, "loyalty/configuration");
      const body = await response.json().catch(() => null);
      initialData = response.ok ? parseLoyaltyConfiguration(body, context.tenantSlug) : null;
      if (!initialData) initialReason = response.status === 403 ? "configuration_forbidden" : typeof body?.reason === "string" ? body.reason : "configuration_unavailable";
    } catch { initialReason = "configuration_unavailable"; }
  }
  const canWrite = Boolean(context.tenantSlug && !session.isDemo) && (session.role === "super-admin"
    ? !dashboardPermissionDenied(session.deniedPermissions, "rewards:write")
    : dashboardPermissionMatches(session.permissions, "rewards:write", session.deniedPermissions));
  return <LoyaltyConfigurationWorkspace key={`${context.tenantSlug}:${Boolean(session.isDemo)}`} tenant={context.tenantSlug} canSelectTenant={context.canSelectTenant}
    canWrite={canWrite} initialData={initialData} initialReason={initialReason} isDemo={Boolean(session.isDemo)} />;
}
