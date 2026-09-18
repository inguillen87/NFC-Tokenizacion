import { checkAdminWithPermission,checkAdminPermission,getAdminActor,getAdminTenantAccess } from "./auth";
import { json } from "./http";
import { readBoundedJsonBody } from "./bounded-request-body";
import { readStudio,studioReadView,mutateStudio,studioFailure,StudioError,type StudioActor } from "./passport-editorial-service";
const PERMISSIONS:Record<string,string>={start:"batch.product.configure",save:"batch.product.configure",submit:"batch.product.configure",reopen:"batch.product.configure",request_changes:"batch.product.review",approve:"batch.product.review",publish:"batch.product.publish"};
export async function passportStudioRequest(req:Request,bid:string,action?:string){
  const permission=action?PERMISSIONS[action]:"batches:read";if(!permission)return json({ok:false,reason:"editorial_action_invalid"},400);
  const auth=await checkAdminWithPermission(req,permission);if(auth)return auth;
  try{
    const principal=getAdminActor(req);if(!principal.id)throw new StudioError("editorial_actor_required",403);
    const actor:StudioActor={actorId:principal.id,label:principal.label||"Usuario autorizado",canEdit:!checkAdminPermission(req,"batch.product.configure"),canReview:!checkAdminPermission(req,"batch.product.review"),canPublish:!checkAdminPermission(req,"batch.product.publish")};
    const query=new URL(req.url).searchParams;const {effectiveTenantSlug}=getAdminTenantAccess(req,query.get("tenant"));
    if(!bid||bid.length>160)return json({ok:false,reason:"editorial_bid_invalid"},400);
    let data;
    if(action){const body=await readBoundedJsonBody<any>(req,98304);const header=req.headers.get("idempotency-key");if(header&&header!==body?.operationId)throw new StudioError("editorial_request_id_conflict",400);data=await mutateStudio(effectiveTenantSlug,bid,actor,body,action);}
    else data=studioReadView(await readStudio(effectiveTenantSlug,bid),actor);
    return json(data,200,{"cache-control":"private, no-store"});
  }catch(error){const failure=studioFailure(error);console.warn("[passport_editorial]",failure.reason);return json({ok:false,...failure},failure.status,{"cache-control":"private, no-store"});}
}
