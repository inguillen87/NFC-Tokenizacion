import {BatchWorkspaceNavigationServer} from "../../../../../components/batch-workspace-navigation-server";
import {dashboardSessionCanOpenDestination} from '../../../../../lib/dashboard-destination-guard';
import {requireDashboardSession} from '../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../../lib/batch-dossier-readings';
import {parseBatchChannels,type BatchChannels} from '../../../../../lib/batch-channels';
import {BatchChannelWorkspace} from '../../../../../components/batch-channels';
export default async function ChannelsPage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read');const {bid}=await params,q=await searchParams,context=await createAdminPageContext(session,q.tenant);let data:BatchChannels|null=null;
 if(!session.isDemo)try{const r=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/channels`,{signal:AbortSignal.timeout(12000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo')data=parseBatchChannels(await boundedDossierJson(r),bid,context.tenantSlug);}catch{}
 return <><BatchWorkspaceNavigationServer bid={bid} tenant={context.tenantSlug} current="channels" session={session}/><BatchChannelWorkspace key={`${session.id}:${context.tenantSlug}:${bid}`} initial={data} bid={bid} tenant={context.tenantSlug} canOrder={dashboardSessionCanOpenDestination(session,'supplierBatches')}/></>;
}
