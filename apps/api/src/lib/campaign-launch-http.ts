import {checkAdmin,checkAdminPermission,getAdminPrincipal,type AdminSessionResolver} from './auth';
import {permissionDenied} from './permission-matcher.js';
import {readBoundedJsonBody} from './bounded-request-body';
import {LaunchError,launchCapabilities,launchFailure,type LaunchActor} from './campaign-launch-policy';
import {launchBoard,launchDetail,mutateLaunch} from './campaign-launch-service';
export async function handleCampaignLaunch(req:Request,id?:string,action?:string,sessionResolver?:AdminSessionResolver){
 const headers={'cache-control':'private, no-store','content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff'};
 const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator'],sessionResolver);if(auth)return auth;
 try{const p=getAdminPrincipal(req);const actor:LaunchActor={id:p.userId,label:p.label,...launchCapabilities(p.role,k=>!checkAdminPermission(req,k),k=>permissionDenied(p.deniedPermissions,k),p.mfaVerified)};
 if(!actor.canRead)throw new LaunchError('launch_read_forbidden',403);
 const q=new URL(req.url).searchParams,requested=q.get('tenant')||'';if(p.tenantSlug&&requested&&p.tenantSlug!==requested)throw new LaunchError('launch_tenant_forbidden',403);
 if(p.scope!=='super_admin'&&!p.tenantSlug)throw new LaunchError('launch_scope_forbidden',403);
 const tenant=p.tenantSlug||requested;
 const result=action?await mutateLaunch(tenant,id!,actor,action,await readBoundedJsonBody(req,8192)):id?await launchDetail(tenant,id,actor,q.get('export')==='1'):await launchBoard(tenant,actor,p.scope==='super_admin');
 const body=JSON.stringify(result);if(Buffer.byteLength(body)>262144)throw new LaunchError('launch_response_limit',503);return new Response(body,{headers});
 }catch(e){const f=launchFailure(e);return new Response(JSON.stringify({ok:false,reason:f.reason}),{status:f.status,headers});}
}
