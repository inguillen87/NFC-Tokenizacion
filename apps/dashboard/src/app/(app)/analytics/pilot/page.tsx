import {canReadPilotReport} from '../../../../lib/pilot-report-access';
import {requireDashboardSession} from '../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../lib/batch-dossier-readings';
import {parsePilotOptions} from '../../../../lib/pilot-report';
import {PilotReportWorkspace} from '../../../../components/pilot-report';
export default async function PilotPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession(),query=await searchParams,context=await createAdminPageContext(session,query.tenant);
 const authorized=canReadPilotReport(session);
 let initial:ReturnType<typeof parsePilotOptions>|null=null;
 if(authorized)try{const r=await fetchAdminPage(context,'pilot-report/options',{signal:AbortSignal.timeout(10000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo')initial=parsePilotOptions(await boundedDossierJson(r),context.tenantSlug,!context.canSelectTenant);}catch{}
 const to=new Date().toISOString().slice(0,10),from=new Date(Date.parse(to+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);
 return <PilotReportWorkspace key={`${session.id}:${context.tenantSlug}`} initial={initial} initialTenant={context.tenantSlug} tenantBound={!context.canSelectTenant} fromDefault={from} toDefault={to} authorized={authorized}/>;
}
