import {checkAdmin,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {traceFilters,traceFailure,TraceError} from './batch-trace-policy';
import {readBatchTrace,readTraceDetail} from './batch-trace-service';
import {json} from './http';
export async function handleBatchTrace(req:Request,bid:string,eventId?:string,resolver?:AdminSessionResolver){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 try{
  if(req.method!=='GET') return json({ok:false,reason:'method_not_allowed'},405,headers);
  const denied=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator','reseller'],resolver);
  if(denied)return denied;
  for(const permission of ['batches:read','logistics:read']){const block=checkAdminPermission(req,permission);if(block)return block;}
  const url=new URL(req.url),principal=getAdminPrincipal(req),requested=url.searchParams.get('tenant');
  if(principal.tenantSlug&&requested&&principal.tenantSlug!==requested)throw new TraceError('trace_tenant_mismatch',403);
  const tenant=getAdminTenantAccess(req,requested).effectiveTenantSlug,filters=traceFilters(url.searchParams);
  const result=eventId?await readTraceDetail(tenant,bid,eventId,filters):await readBatchTrace(tenant,bid,filters);
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>262144)throw new TraceError('trace_response_over_limit',503);
  return json(result,200,headers);
 }catch(error){const f=traceFailure(error);return json({ok:false,reason:f.reason},f.status,headers);}
}
