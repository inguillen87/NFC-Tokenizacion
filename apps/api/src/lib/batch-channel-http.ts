import {checkAdmin,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
import {permissionDenied} from './permission-matcher.js';
import {ChannelError} from './batch-channel-service';
export async function channelAccess(req:Request,write=false,sessionResolver?:AdminSessionResolver){
 const auth=await checkAdmin(req,undefined,sessionResolver);if(auth)return {response:auth};
 const read=checkAdminPermission(req,'batches:read');if(read)return {response:read};
 const principal=getAdminPrincipal(req);
 const canWrite=!permissionDenied(principal.deniedPermissions,'gs1:write')&&(!checkAdminPermission(req,'gs1:write')||!checkAdminPermission(req,'batch.product.configure'));
 if(write&&!canWrite)return {response:new Response(JSON.stringify({ok:false,reason:'channel_write_forbidden'}),{status:403,headers:{'content-type':'application/json'}})};
 const requested=new URL(req.url).searchParams.get('tenant');
 if(principal.tenantSlug&&requested&&principal.tenantSlug!==requested)throw new ChannelError('channel_tenant_mismatch',403);
 const {effectiveTenantSlug}=getAdminTenantAccess(req,requested);
 return {principal,canWrite,tenant:effectiveTenantSlug};
}
