import {recallCapabilities} from './recall-authority';
import {checkAdmin,checkAdminPermission,getAdminPrincipal,type AdminSessionResolver} from './auth';
import {permissionDenied} from './permission-matcher.js';
import {readBoundedJsonBody} from './bounded-request-body';
import {json} from './http';
import {recallBoard,recallDetail,mutateRecall} from './recall-service';
import {RecallError,recallFailure,type RecallAction,type RecallActor} from './recall-policy';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
export async function handleRecall(req:Request,bid:string,action?:string,id?:string,sessionResolver?:AdminSessionResolver){
 const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator'],sessionResolver);if(auth)return auth;
 try{
 const p=getAdminPrincipal(req);
 const actor:RecallActor={id:p.userId,label:p.label,...recallCapabilities(p.role,key=>!checkAdminPermission(req,key),key=>permissionDenied(p.deniedPermissions,key),p.mfaVerified)};
 const q=new URL(req.url).searchParams,requested=q.get('tenant')||'';
 if(p.tenantSlug&&requested&&requested!==p.tenantSlug)throw new RecallError('recall_tenant_forbidden',403);
 const tenant=p.tenantSlug||requested;if(!actor.canRead)throw new RecallError('recall_read_forbidden',403);
 const result=action?await mutateRecall(tenant,bid,actor,action as RecallAction,await readBoundedJsonBody(req,65536)):id?await recallDetail(tenant,bid,id,actor,q.get('export')==='1'):await recallBoard(tenant,bid,actor);
 const body=JSON.stringify(result);if(Buffer.byteLength(body)>1048576)throw new RecallError('recall_response_limit',503);
 return new Response(body,{headers:{...headers,'content-type':'application/json; charset=utf-8'}});
 }catch(e){const f=recallFailure(e);return json({ok:false,reason:f.reason},f.status,headers);}
}
