import {requireDashboardDestination,dashboardSessionCanOpenDestination} from '../../../../lib/dashboard-destination-guard';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../lib/batch-dossier-readings';
import {parseAssignedBoard,parseAssignedDetail,type AssignedTaskBoard,type AssignedTaskDetail} from '../../../../lib/recall-assigned-tasks';
import {AssignedRecallWorkspace} from '../../../../components/recall-assigned-workspace';
export default async function AssignedRecalls({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardDestination('recallTasks'),q=await searchParams;const expected={actorId:session.userId||'',tenant:session.tenantSlug||null};let initial:AssignedTaskBoard|null=null;
 if(!session.isDemo)try{const context=await createAdminPageContext(session);const r=await fetchAdminPage(context,'recall-tasks',{signal:AbortSignal.timeout(12000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo')initial=parseAssignedBoard(await boundedDossierJson(r),expected);}catch{}
 let initialDetail:AssignedTaskDetail|null=null;
 const selected=typeof q.case==='string'&&typeof q.destination==='string'?{caseId:q.case,destinationId:q.destination}:null;
 if(selected&&!session.isDemo)try{const ctx=await createAdminPageContext(session);const r=await fetchAdminPage(ctx,`recall-tasks/${encodeURIComponent(selected.caseId)}/${encodeURIComponent(selected.destinationId)}`,{signal:AbortSignal.timeout(12000)});if(r.ok)initialDetail=parseAssignedDetail(await boundedDossierJson(r),expected,selected.caseId,selected.destinationId);}catch{}
 return <AssignedRecallWorkspace key={expected.actorId} initial={initial} initialDetail={initialDetail} expected={expected} initialSelection={selected} canOpenBatches={dashboardSessionCanOpenDestination(session,'batches')} demo={session.isDemo===true}/>;
}
