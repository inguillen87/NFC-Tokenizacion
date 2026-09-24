import {checkAdmin,checkAdminPermission,getAdminPrincipal} from './auth';
import {sql} from './db';
import {collectRuntimeReadiness,projectRuntimeReadiness} from './runtime-readiness';
const defaults={authorize:checkAdmin,permission:checkAdminPermission,principal:getAdminPrincipal,query:sql,environment:()=>process.env,now:()=>Date.now()};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store, max-age=0','pragma':'no-cache','expires':'0','vary':'Authorization','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
export function makeRuntimeReadinessHandler(overrides:Partial<typeof defaults>={}){
 const d={...defaults,...overrides};
 return async(req:Request)=>{
  try{
   // Scope and explicit deny are both checked. Tenant audit capability is not global operational access.
   const auth=await d.authorize(req,['super_admin']);
   if(auth){const status=[401,403,429,503].includes(auth.status)?auth.status:503;const r=json({ok:false,reason:status===503?'runtime_identity_unavailable':'runtime_readiness_unauthorized'},status);const retry=auth.headers.get('retry-after');if(retry&&/^\d{1,4}$/.test(retry))r.headers.set('retry-after',retry);return r;}
   const principal=d.principal(req);if(principal.scope!=='super_admin'||principal.tenantId||principal.tenantSlug||d.permission(req,'audit.read'))return json({ok:false,reason:'runtime_readiness_forbidden'},403);
   if(req.method!=='GET')return json({ok:false,reason:'runtime_readiness_method_not_allowed'},405);
   if(new URL(req.url).search||req.headers.has('x-http-method-override'))return json({ok:false,reason:'runtime_readiness_selector_not_allowed'},400);
   return json({ok:true,...projectRuntimeReadiness(await collectRuntimeReadiness(d.query),d.environment(),d.now())});
  }catch{return json({ok:false,reason:'runtime_readiness_unavailable'},503);}
 };
}
