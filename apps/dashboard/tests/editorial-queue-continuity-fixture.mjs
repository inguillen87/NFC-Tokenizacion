// Synthetic queue contract for tests only; never imported by application code.
export const filters={state:'',view:'all',q:''};
export function queueFixture(tenant='company',f=filters,page=1,total=35){
 const rows=Array.from({length:total},(_,n)=>({id:`10000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`,bid:'LOT-'+(n+1),tenant,tenantName:'Empresa de prueba '+tenant,product:'Producto '+(n+1),state:'in_review',revision:3,publishedVersion:0,template:'general',locale:'es-AR',updatedAt:new Date(Date.UTC(2026,8,29,0,n)).toISOString(),lastChange:{actorLabel:'Equipo de prueba',note:null,action:'submit',at:new Date(Date.UTC(2026,8,29,0,n)).toISOString()},code:'review',forActor:true}));
 const matching=rows.filter(r=>(!f.state||r.state===f.state)&&(!f.q||r.product.includes(f.q)));
 const items=matching.slice((page-1)*25,page*25),hasNext=page*25<matching.length;
 return {ok:true,protocol:'nexid.editorial-queue.v1',source:'database',readOnly:true,observedAt:'2026-09-29T02:00:00Z',scope:{tenant,mode:tenant?'tenant':'global'},filters:{...f},summary:{total,byState:{draft:0,changes_requested:0,in_review:total,approved:0,published:0},forActor:total,basis:'enrolled_passports_in_scope'},matched:matching.length,items,navigation:{page,pageSize:25,hasNext,nextCursor:hasNext?'page_'+(page+1):null,order:'oldest_update_first',consistency:'live_queue_rechecked_on_each_request'}};
}
