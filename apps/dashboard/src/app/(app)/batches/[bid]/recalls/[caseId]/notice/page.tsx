import {requireDashboardSession} from '../../../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../../../lib/admin-page-access';
import {canReadRecallWorkspace} from '../../../../../../../lib/recall-workspace';
import {parseNoticeBoard,readRecallJson,type NoticeBoard} from '../../../../../../../lib/notice-review-workspace';
import {NoticeReviewWorkspace} from '../../../../../../../components/notice-review-workspace';
export default async function NoticeReviewPage({params,searchParams}:{params:Promise<{bid:string;caseId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession();const {bid,caseId}=await params,q=await searchParams,context=await createAdminPageContext(session,q.tenant);let data:NoticeBoard|null=null;
 if(canReadRecallWorkspace(session))try{const r=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/notice-reviews/${encodeURIComponent(caseId)}`,{signal:AbortSignal.timeout(12000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo')data=parseNoticeBoard(await readRecallJson(r),bid,context.tenantSlug,caseId);}catch{}
 return <NoticeReviewWorkspace key={`${session.id}:${context.tenantSlug}:${caseId}`} initial={data} bid={bid} tenant={context.tenantSlug} caseId={caseId}/>;
}
