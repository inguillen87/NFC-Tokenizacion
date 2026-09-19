import {requireDashboardSession} from '../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../lib/batch-dossier-readings';
import {parseEditorialQueue,INITIAL_QUEUE_FILTERS,queueParams,type EditorialQueue,type QueueFilters} from '../../../../lib/editorial-queue';
import {EditorialQueueWorkspace} from '../../../../components/editorial-queue';
export default async function EditorialReviewPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read'),params=await searchParams,context=await createAdminPageContext(session,params.tenant);
 const filters:QueueFilters={...INITIAL_QUEUE_FILTERS};for(const k of ['state','view','q'] as const)if(typeof params[k]==='string')(filters as Record<string,string>)[k]=params[k] as string;
 let initial:EditorialQueue|null=null;
 if(!session.isDemo)try{const response=await fetchAdminPage(context,'passport-editorial/queue?'+queueParams('',filters),{signal:AbortSignal.timeout(12000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')initial=parseEditorialQueue(await boundedDossierJson(response),context.tenantSlug,filters);}catch{}
 return <EditorialQueueWorkspace key={`${session.id}:${context.tenantSlug}`} initial={initial} tenant={context.tenantSlug} filters={filters} enabled={!session.isDemo}/>;
}
