import {checkAdmin,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {readBatchTraceability} from './batch-traceability-service';
import {TraceabilityError} from './batch-traceability-projection';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export async function handleBatchTraceability(req:Request,bid:string,resolver?:AdminSessionResolver){
  try {
    if(req.method!=='GET')return Response.json({ok:false,reason:'method_not_allowed'},{status:405,headers});
    const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator','reseller'],resolver);if(auth)return auth;
    const read=checkAdminPermission(req,'batches:read');if(read)return read;
    const actor=getAdminPrincipal(req),u=new URL(req.url),tenant=u.searchParams.get('tenant');
    if(actor.tenantSlug&&tenant&&tenant!==actor.tenantSlug)throw new TraceabilityError('trace_tenant_forbidden',403);
    if(u.searchParams.has('tenant_id')||[...u.searchParams.keys()].some(k=>!['tenant','from','to'].includes(k)))throw new TraceabilityError('trace_query_invalid');
    for(const key of ['tenant','from','to'])if(u.searchParams.getAll(key).length>1)throw new TraceabilityError('trace_query_invalid');
    const {effectiveTenantSlug}=getAdminTenantAccess(req,tenant);
    const result=await readBatchTraceability({tenant:effectiveTenantSlug,bid,from:u.searchParams.get('from'),to:u.searchParams.get('to'),canLogistics:['super_admin','tenant_admin'].includes(actor.scope)&&!checkAdminPermission(req,'logistics:read')});
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>1048576)throw new TraceabilityError('trace_response_limit',503);
    return Response.json(result,{headers});
  }catch(e){const error=e instanceof TraceabilityError?e:new TraceabilityError('trace_source_unavailable',503);return Response.json({ok:false,reason:error.code},{status:error.status,headers});}
}
