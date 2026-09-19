import {traceRequestScopeAllowed} from '../../../../../lib/batch-traceability-access';
import {requireDashboardSession} from '../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {dashboardSessionCanOpenDestination} from '../../../../../lib/dashboard-destination-guard';
import {parseBatchTrace,readTraceJson,type BatchTrace} from '../../../../../lib/batch-traceability';
import {BatchTraceabilityWorkspace} from '../../../../../components/batch-traceability-workspace';
export default async function TraceabilityPage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read'),{bid}=await params,query=await searchParams,context=await createAdminPageContext(session,query.tenant);let data:BatchTrace|null=null;
 if(!traceRequestScopeAllowed(session,query.tenant))return <main><h1>Alcance no autorizado</h1><p>Este recorrido requiere la empresa de tu sesión o una selección autorizada de superadministración.</p></main>;
 const filters=new URLSearchParams();for(const k of ['from','to'])if(typeof query[k]==='string')filters.set(k,query[k] as string);
 if(!session.isDemo)try{const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/traceability?${filters}`,{signal:AbortSignal.timeout(14000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')data=parseBatchTrace(await readTraceJson(response),bid,context.tenantSlug);}catch{}
 return <BatchTraceabilityWorkspace key={`${session.id}:${context.tenantSlug}:${bid}`} initial={data} bid={bid} tenant={context.tenantSlug} canLogistics={dashboardSessionCanOpenDestination(session,'logistics')} enabled={!session.isDemo}/>;
}
