import {checkAdminWithPermission,checkAdminPermission,getAdminPrincipal,getAdminActor,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {queueFilters,QueueError} from './editorial-queue-policy';
import {readEditorialQueue} from './editorial-queue-service';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export async function editorialQueueRequest(req:Request,resolver?:AdminSessionResolver){
 try{
  if(req.method!=='GET')return Response.json({ok:false,reason:'method_not_allowed'},{status:405,headers});
  const denied=await checkAdminWithPermission(req,'batches:read',resolver);if(denied)return denied;
  const principal=getAdminPrincipal(req),actor=getAdminActor(req),p=new URL(req.url).searchParams,requested=p.get('tenant');
  if(principal.tenantSlug&&requested&&requested!==principal.tenantSlug)throw new QueueError('editorial_queue_tenant_forbidden',403);
  const filters=queueFilters(p),scope=getAdminTenantAccess(req,requested);
  const result=await readEditorialQueue(scope.effectiveTenantSlug,filters,p.get('cursor'),{id:actor.id||'',edit:!checkAdminPermission(req,'batch.product.configure'),review:!checkAdminPermission(req,'batch.product.review'),publish:!checkAdminPermission(req,'batch.product.publish')});
  return Response.json(result,{headers});
 }catch(e){const x=e instanceof QueueError?e:new QueueError('editorial_queue_unavailable',503);return Response.json({ok:false,reason:x.code},{status:x.status,headers});}
}
