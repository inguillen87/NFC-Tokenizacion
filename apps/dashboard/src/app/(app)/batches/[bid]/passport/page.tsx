import Link from "next/link";
import {requireDashboardDestination} from "../../../../../lib/dashboard-destination-guard";
import {createAdminPageContext,fetchAdminPage} from "../../../../../lib/admin-page-access";
import {parseStudioEntry} from "../../../../../lib/passport-studio-entry";
import {boundedJSON} from "../../../../../lib/passport-studio-transport";
import {PassportStudioEntry} from "../../../../../components/passport-studio/passport-studio-entry";
export default async function PassportStudioPage({params,searchParams}:{params:Promise<{bid:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const session=await requireDashboardDestination("batches");const {bid}=await params;const query=await searchParams;
 const context=await createAdminPageContext(session,query.tenant);let entry:ReturnType<typeof parseStudioEntry>|null=null,reason="source_unavailable";
 if(!session.isDemo){try{const response=await fetchAdminPage(context,`batches/${encodeURIComponent(bid)}/passport-editorial`,{signal:AbortSignal.timeout(12000)});
   if(response.ok&&response.headers.get('x-nexid-data-mode')!=='demo')entry=parseStudioEntry(await boundedJSON(response),{bid,tenantId:session.tenantId});
   else reason=response.status===403?'permission_denied':response.status===404?'not_found':'source_unavailable';
 }catch{reason='source_unavailable';}}
 else reason='demo_not_allowed';
 return <div className="space-y-4 min-w-0"><div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link prefetch={false} href={`/batches/${encodeURIComponent(bid)}?${new URLSearchParams(context.tenantSlug?{tenant:context.tenantSlug}:{})}`} className="rounded-lg border border-slate-400/30 px-4 py-2 font-semibold">← Volver al expediente</Link><Link prefetch={false} href={"/passports/review?"+new URLSearchParams(context.tenantSlug?{tenant:context.tenantSlug}:{})} className="rounded-lg border border-slate-400/30 px-4 py-2 font-semibold">Bandeja editorial</Link><span className="text-xs text-slate-400">Contenido editorial · no modifica la autenticidad ni el precinto</span></div>
 {entry?<PassportStudioEntry key={`${entry.snapshot?.scope.tenantId||entry.enrollment?.scope.tenantId}:${bid}`} initial={entry.snapshot} enrollment={entry.enrollment} tenantSlug={context.tenantSlug} endpoint={`/api/admin/batches/${encodeURIComponent(bid)}/passport-editorial`}/>:<section className="rounded-2xl border border-slate-400/25 p-6" data-testid="passport-source-error"><h1 className="text-xl font-bold">Passport Studio no disponible para esta consulta</h1><p className="mt-3 text-sm leading-7">{reason==='permission_denied'?'La cuenta no tiene permiso para abrir este contenido.':reason==='not_found'?'No se encontró el lote en el alcance autorizado.':reason==='demo_not_allowed'?'La sesión demo no modifica ni simula borradores de clientes.':'La fuente no confirmó el contenido. No se muestran formularios vacíos como si fueran el pasaporte del lote.'}</p><Link prefetch={false} href={`/batches/${encodeURIComponent(bid)}/passport?${new URLSearchParams(context.tenantSlug?{tenant:context.tenantSlug}:{})}`} className="mt-4 inline-flex rounded-lg border border-slate-400/30 px-4 py-2">Volver a consultar</Link></section>}
 </div>;
}
