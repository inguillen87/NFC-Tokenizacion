import {requireDashboardSession} from '../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../lib/admin-page-access';
import {boundedDossierJson} from '../../../../lib/batch-dossier-readings';
import {parseLaunchBoard,parseLaunchDetail,type LaunchBoard,type LaunchDetail} from '../../../../lib/campaign-launch';
import {CampaignLaunchWorkspace} from '../../../../components/campaign-launch-workspace';
export default async function CampaignReviewPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession('campaigns:read'),q=searchParams?await searchParams:{},ctx=await createAdminPageContext(session,q.tenant);let board:LaunchBoard|null=null,detail:LaunchDetail|null=null;
 if(!session.isDemo)try{const r=await fetchAdminPage(ctx,'campaigns/launch',{signal:AbortSignal.timeout(12000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo'){board=parseLaunchBoard(await boundedDossierJson(r),ctx.tenantSlug);if(typeof q.draft==='string'&&board.scope&&board.drafts.some(d=>d.id===q.draft)){const r=await fetchAdminPage(ctx,'campaigns/launch/'+q.draft,{signal:AbortSignal.timeout(12000)});if(r.ok)detail=parseLaunchDetail(await boundedDossierJson(r),ctx.tenantSlug,q.draft);}}}catch{}
 return <CampaignLaunchWorkspace key={`${session.id}:${ctx.tenantSlug}`} initial={board} initialDetail={detail} tenantScope={ctx.tenantSlug} global={ctx.isGlobal}/>;
}
