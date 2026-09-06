import LoyaltyCampaignsClient from "./loyalty-campaigns-client";
import { createAdminPageContext } from "../../../../lib/admin-page-access";
import { requireDashboardSession } from "../../../../lib/session";
import { dashboardPermissionDenied, dashboardPermissionMatches } from "../../../../lib/permission-policy";

export default async function LoyaltyCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("campaigns:read");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const canWriteDrafts = Boolean(adminContext.tenantSlug) && !session.isDemo && (
    session.role === "super-admin"
      ? !dashboardPermissionDenied(session.deniedPermissions, "campaigns:write")
      : dashboardPermissionMatches(session.permissions, "campaigns:write", session.deniedPermissions)
  );

  return (
    <LoyaltyCampaignsClient
      key={`${adminContext.tenantSlug}:${Boolean(session.isDemo)}`}
      tenantScope={adminContext.tenantSlug}
      allowDemoData={Boolean(session.isDemo)}
      canWriteDrafts={canWriteDrafts}
    />
  );
}

