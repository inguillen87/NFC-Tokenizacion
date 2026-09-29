import {createHash} from 'node:crypto';
import {requireDashboardSession} from '../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {INITIAL_QUEUE_FILTERS,queueParams,queueFiltersFromSearch,type EditorialQueue,type QueueFilters} from '../../../../lib/editorial-queue';
import {readEditorialQueue,EditorialQueueReadError,QUEUE_READ_COPY} from '../../../../lib/editorial-queue-read';
import {EditorialQueueWorkspace} from '../../../../components/editorial-queue';
export default async function EditorialReviewPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read'),params=await searchParams;
 const context=await createAdminPageContext(session,params.tenant);
 let filters:QueueFilters={...INITIAL_QUEUE_FILTERS},initial:EditorialQueue|null=null,initialError:string|undefined;
 try{filters=queueFiltersFromSearch(params);}catch{initialError='El enlace contiene filtros inválidos o repetidos. Revisá las opciones y consultá de nuevo.';}
 if(!session.isDemo&&!initialError)try{
  initial=await readEditorialQueue({tenant:context.tenantSlug,filters},(_url,init)=>fetchAdminPage(context,'passport-editorial/queue?'+queueParams('',filters),init));
 }catch(e){initialError=QUEUE_READ_COPY[e instanceof EditorialQueueReadError?e.code:'unavailable'];}
 // Only a nonreversible context identity reaches the client; no cookie or session identifier.
 const contextKey=createHash('sha256').update(JSON.stringify([session.id,session.userId,session.role,session.tenantId,session.tenantSlug,session.permissions,session.deniedPermissions,session.isDemo,context.tenantSlug])).digest('hex');
 return <EditorialQueueWorkspace contextKey={contextKey} initial={initial} tenant={context.tenantSlug} filters={filters} initialError={initialError} enabled={!session.isDemo}/>;
}
