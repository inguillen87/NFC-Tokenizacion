import LoyaltyCampaignsClient from "./loyalty-campaigns-client";
import { createAdminPageContext } from "../../../../lib/admin-page-access";
import { requireDashboardSession } from "../../../../lib/session";

export default async function LoyaltyCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session, query.tenant);

  return (
    <LoyaltyCampaignsClient
      tenantScope={adminContext.tenantSlug}
      allowDemoData={Boolean(session.isDemo)}
    />
  );
}

