import {checkAdmin,checkAdminPermission,getAdminPrincipal,type AdminSessionResolver} from './auth';
import {permissionDenied} from './permission-matcher.js';
import {recallTaskCapabilities,type TaskActor} from './recall-task-policy';
import {assignedTaskList,assignedTaskDetail,respondAssignedTask} from './recall-task-service';
import {readBoundedJsonBody} from './bounded-request-body';
import {RecallError,recallFailure} from './recall-policy';
import {json} from './http';
export async function handleAssignedRecall(req:Request,caseId?:string,destinationId?:string,action?:string,resolver?:AdminSessionResolver){
 const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator','reseller','readonly_demo'],resolver);if(auth)return auth;
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 try{
  const p=getAdminPrincipal(req),caps=recallTaskCapabilities(p.role,x=>!checkAdminPermission(req,x),x=>permissionDenied(p.deniedPermissions,x));
  const actor:TaskActor={id:p.userId,label:p.label,tenantId:p.tenantId,tenantSlug:p.tenantSlug,...caps};
  if(!caps.canRead)throw new RecallError('recall_task_read_forbidden',403);
  const q=new URL(req.url).searchParams;if(q.get('tenant')&&q.get('tenant')!==p.tenantSlug)throw new RecallError('recall_task_scope_forbidden',403);
  let result;
  if(caseId&&destinationId)result=action?await respondAssignedTask(actor,caseId,destinationId,action,await readBoundedJsonBody(req,8192)):(await assignedTaskDetail(actor,caseId,destinationId)).public;
  else {if(q.has('includeClosed')&&!['0','1'].includes(q.get('includeClosed')||''))throw new RecallError('recall_task_filter_invalid',400);result=await assignedTaskList(actor,q.get('includeClosed')==='1');}
  const encoded=JSON.stringify(result);if(Buffer.byteLength(encoded)>262144)throw new RecallError('recall_task_response_limit',503);
  return new Response(encoded,{headers:{...headers,'content-type':'application/json; charset=utf-8'}});
 }catch(e){const f=recallFailure(e);return json({ok:false,reason:f.reason},f.status,headers);}
}
