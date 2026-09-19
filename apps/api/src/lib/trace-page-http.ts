import {checkAdmin,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {TraceabilityError} from './batch-traceability-projection';
import {readTracePage} from './trace-page-service';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const keys=['tenant','from','to','source','type','gtin','lot','serial','exact','cursor'];
export async function handleTracePage(req:Request,bid:string,resolver?:AdminSessionResolver){
 try{
  if(req.method!=='GET')return Response.json({ok:false,reason:'method_not_allowed'},{status:405,headers});
  const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator','reseller'],resolver);if(auth)return auth;
  const read=checkAdminPermission(req,'batches:read');if(read)return read;
  const actor=getAdminPrincipal(req),u=new URL(req.url),requested=u.searchParams.get('tenant');
  if(actor.tenantSlug&&requested&&requested!==actor.tenantSlug)throw new TraceabilityError('trace_tenant_forbidden',403);
  if([...u.searchParams.keys()].some(k=>!keys.includes(k))||keys.some(k=>u.searchParams.getAll(k).length>1))throw new TraceabilityError('trace_query_invalid');
  const {effectiveTenantSlug}=getAdminTenantAccess(req,requested);
  const result=await readTracePage({tenant:effectiveTenantSlug,bid,from:u.searchParams.get('from'),to:u.searchParams.get('to'),source:u.searchParams.get('source'),type:u.searchParams.get('type'),gtin:u.searchParams.get('gtin'),lot:u.searchParams.get('lot'),serial:u.searchParams.get('serial'),exact:u.searchParams.get('exact'),cursor:u.searchParams.get('cursor'),canLogistics:['super_admin','tenant_admin'].includes(actor.scope)&&!checkAdminPermission(req,'logistics:read')});
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>1048576)throw new TraceabilityError('trace_response_limit',503);
  return Response.json(result,{headers});
 }catch(e){const error=e instanceof TraceabilityError?e:new TraceabilityError('trace_source_unavailable',503);return Response.json({ok:false,reason:error.code},{status:error.status,headers});}
}
