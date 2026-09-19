import {requireDashboardSession} from '../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {parseBatchChannels,type BatchChannels} from '../../../../../lib/batch-channels';
import {boundedDossierJson} from '../../../../../lib/batch-dossier-readings';
import {LabelProductionWorkspace} from '../../../../../components/label-production-workspace';
export default async function BatchProductionPage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read');const {bid}=await params,query=await searchParams,context=await createAdminPageContext(session,query.tenant);let data:BatchChannels|null=null;
 if(!session.isDemo)try{const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/channels`,{signal:AbortSignal.timeout(12000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')data=parseBatchChannels(await boundedDossierJson(response),bid,context.tenantSlug);}catch{}
 return <LabelProductionWorkspace key={`${session.id}:${context.tenantSlug}:${bid}`} initial={data} bid={bid} tenant={context.tenantSlug}/>;
}
