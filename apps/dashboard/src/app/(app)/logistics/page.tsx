import { createAdminPageContext, fetchAdminPage } from "../../../lib/admin-page-access";
import { requireDashboardDestination, dashboardSessionCanOpenDestination } from "../../../lib/dashboard-destination-guard";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { boundedDossierJson } from "../../../lib/batch-dossier-readings";
import { logisticsOverview } from "../../../lib/logistics-workspace-model";
import { LogisticsWorkspace } from "../../../components/logistics-workspace";
export default async function LogisticsHubPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await requireDashboardDestination("logistics");
  const query=await searchParams;const context=await createAdminPageContext(session,query.tenant);
  let overview=logisticsOverview(null,context.tenantSlug,false);
  if(!session.isDemo){
    try{const response=await fetchAdminPage(context,"logistics/shipments",{signal:AbortSignal.timeout(12000)});
      if(response.ok&&response.headers.get("x-nexid-data-mode")!=="demo")overview=logisticsOverview(await boundedDossierJson(response),context.tenantSlug,true);
    }catch{ /* Unavailable is not zero inventory. No secondary query or demo fallback. */ }
  }
  const canWrite=!session.isDemo&&["tenant-admin","super-admin"].includes(session.role)&&dashboardPermissionMatches(session.permissions,"logistics:write",session.deniedPermissions);
  return <LogisticsWorkspace overview={overview} tenant={context.tenantSlug} canWrite={canWrite} canSupplier={dashboardSessionCanOpenDestination(session,"supplierBatches")} role={session.role}/>;
}
