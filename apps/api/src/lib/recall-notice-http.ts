import {checkAdmin,checkAdminPermission,getAdminPrincipal,type AdminSessionResolver} from './auth';
import {recallCapabilities} from './recall-authority';import {permissionDenied} from './permission-matcher.js';
import {readBoundedJsonBody} from './bounded-request-body';import {noticeBoard,mutateNotice,noticeFailure,type NoticeActor} from './recall-notice-service';
import {NoticeReviewError} from './recall-notice-review.mjs';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','content-type':'application/json'};
export async function handleNoticeReview(req:Request,bid:string,caseId:string,action?:string,resolver?:AdminSessionResolver){
 const auth=await checkAdmin(req,['super_admin','tenant_admin','tenant_operator'],resolver);if(auth)return auth;
 try{const p=getAdminPrincipal(req),q=new URL(req.url).searchParams,requested=q.get('tenant')||'';
 const actor:NoticeActor={id:p.userId,label:p.label,role:p.role,tenantId:p.tenantId||null,mfaVerified:p.mfaVerified,...recallCapabilities(p.role,k=>!checkAdminPermission(req,k),k=>permissionDenied(p.deniedPermissions,k),p.mfaVerified)};
 if(p.tenantSlug&&requested&&p.tenantSlug!==requested)throw new NoticeReviewError('notice_review_tenant_forbidden',403);
 const tenant=p.tenantSlug||requested;if(!actor.canRead)throw new NoticeReviewError('notice_review_forbidden',403);
 if(q.get('export')==='1'&&!actor.canExport)throw new NoticeReviewError('notice_review_export_forbidden',403);
 const result=action?await mutateNotice(tenant,bid,caseId,actor,action,await readBoundedJsonBody(req,16384)):await noticeBoard(tenant,bid,caseId,actor);
 const body=JSON.stringify(result);if(Buffer.byteLength(body)>1048576)throw new NoticeReviewError('notice_review_response_limit',503);return new Response(body,{headers});
 }catch(error){const f=noticeFailure(error);return new Response(JSON.stringify({ok:false,reason:f.reason}),{status:f.status,headers});}
}
