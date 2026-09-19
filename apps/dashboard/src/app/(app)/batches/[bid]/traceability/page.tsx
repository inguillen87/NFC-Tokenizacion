import {redirect} from 'next/navigation';
import {requireDashboardSession} from '../../../../../lib/session';
import {dashboardPermissionMatches} from '../../../../../lib/permission-policy';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../../lib/batch-dossier-readings';
import {defaultTraceFilters,parseTrace,type TraceSnapshot} from '../../../../../lib/batch-trace-model';
import {BatchTraceWorkspace} from '../../../../../components/batch-trace-workspace';
export default async function TracePage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read');
 if(!dashboardPermissionMatches(session.permissions,'logistics:read',session.deniedPermissions))redirect('/batches');
 const {bid}=await params,query=await searchParams,context=await createAdminPageContext(session,query.tenant),filters=defaultTraceFilters();
 for(const field of ['from','to','eventType','identityId'] as const)if(typeof query[field]==='string')filters[field]=query[field] as string;
 let data:TraceSnapshot|null=null;
 if(!session.isDemo)try{const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/traceability?${new URLSearchParams(filters)}`,{signal:AbortSignal.timeout(12000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')data=parseTrace(await boundedDossierJson(response),bid,context.tenantSlug,filters);}catch{}
 return <BatchTraceWorkspace key={`${session.id}:${context.tenantSlug}:${bid}`} initial={data} bid={bid} tenant={context.tenantSlug} initialFilters={filters}/>;
}
