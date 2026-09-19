import {requireDashboardSession} from '../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {traceRequestScopeAllowed} from '../../../../../lib/batch-traceability-access';
import {boundedDossierJson} from '../../../../../lib/batch-dossier-readings';
import {canUseEpcisIntake} from '../../../../../lib/epcis-intake-access';
import {parseIntakeBoard,type IntakeBoard} from '../../../../../lib/epcis-intake-model';
import {EpcisIntakeWorkspace} from '../../../../../components/epcis-intake-workspace';
export default async function IntakePage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('batches:read'),{bid}=await params,query=await searchParams;
 if(!canUseEpcisIntake(session)||!traceRequestScopeAllowed(session,query.tenant))return <main><h1>Acceso no autorizado</h1><p>Esta operación requiere lectura de lotes y logística en la empresa autorizada. Confirmar también requiere escritura logística y MFA.</p></main>;
 const context=await createAdminPageContext(session,query.tenant);let data:IntakeBoard|null=null;
 try{const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/epcis-intake`,{signal:AbortSignal.timeout(12000)});if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')data=parseIntakeBoard(await boundedDossierJson(response),bid,context.tenantSlug);}catch{}
 return <EpcisIntakeWorkspace key={`${session.id}:${context.tenantSlug}:${bid}`} initial={data} tenant={context.tenantSlug} bid={bid}/>;
}
