import {BatchWorkspaceNavigationServer} from "../../../../../components/batch-workspace-navigation-server";
import Link from 'next/link';
import {requireDashboardSession} from '../../../../../lib/session';
import {createAdminPageContext,fetchAdminPage} from '../../../../../lib/admin-page-access';
import {canReadRecallWorkspace,parseRecallBoard,readRecallJson,type RecallBoard} from '../../../../../lib/recall-workspace';
import {RecallWorkspace} from '../../../../../components/recall-workspace';
export default async function RecallPage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardSession(),{bid}=await params,q=await searchParams;
 if(!canReadRecallWorkspace(session))return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Retiros: acceso restringido</h1><p>Tu cuenta necesita acceso autorizado a incidentes para consultar el seguimiento de este lote. No se modificó tu rol.</p><Link href="/batches" prefetch={false}>Volver a lotes</Link></main>;
 const ctx=await createAdminPageContext(session,q.tenant);let board:RecallBoard|null=null;
 try{const r=await fetchAdminPage(ctx,`batches/${encodeURIComponent(bid)}/recalls`,{signal:AbortSignal.timeout(12000)});if(r.ok&&r.headers.get('x-nexid-data-mode')!=='demo')board=parseRecallBoard(await readRecallJson(r),bid,ctx.tenantSlug);}catch{}
 return <><BatchWorkspaceNavigationServer bid={bid} tenant={ctx.tenantSlug} current="recalls" session={session}/><RecallWorkspace key={`${session.id}:${ctx.tenantSlug}:${bid}`} initial={board} bid={bid} tenant={ctx.tenantSlug}/></>;
}
