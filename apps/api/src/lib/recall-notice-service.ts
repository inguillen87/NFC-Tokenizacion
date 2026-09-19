import {sql} from './db';
import {recallBatch} from './recall-service';
import {recallId,RecallError} from './recall-policy';
import {planNoticeReview,parseNoticeReviewCommand,authorizeNoticeReview,NoticeReviewError,noticeReviewDigest} from './recall-notice-review.mjs';
export type NoticeActor={id:string;label:string;role:string;tenantId:string|null;mfaVerified:boolean;canRead:boolean;canWrite:boolean;canPublish:boolean;canExport:boolean};
const iso=(v:any)=>new Date(v).toISOString();
export async function noticeSource(tenant:string,bid:string,caseId:string){
 const batch=await recallBatch(tenant,bid);recallId(caseId);
 const rows=await sql`SELECT c.id::text,c.version,c.state,c.published_at,c.document,h.notice,h.notice_version,h.state AS notice_state,h.effective_at,h.resolution_message,now() AS checked_at
 FROM product_recall_cases c LEFT JOIN product_recall_notice_heads h ON h.case_id=c.id AND h.tenant_id=c.tenant_id
 WHERE c.id=${caseId}::uuid AND c.tenant_id=${batch.tenant_id}::uuid AND c.batch_id=${batch.id}::uuid LIMIT 1`;
 const r=rows[0] as any;if(!r)throw new NoticeReviewError('notice_review_case_not_found',404);
 if(!r.published_at)throw new NoticeReviewError('notice_review_requires_published_case',409);
 const current={tenantId:batch.tenant_id,batchId:batch.id,caseId:r.id,caseVersion:Number(r.version),noticeVersion:Number(r.notice_version||1),trackingState:r.state,publishedAt:iso(r.published_at),noticeState:r.notice_state||'active',notice:r.notice||{title:r.document.title,publicMessage:r.document.publicMessage,instructions:r.document.instructions,contact:r.document.contact}};
 return {batch,current,kind:r.document.kind,resolutionMessage:r.resolution_message||null,effectiveAt:iso(r.effective_at||r.published_at),observedAt:iso(r.checked_at)};
}
export async function noticeBoard(tenant:string,bid:string,caseId:string,actor:NoticeActor){
 if(!actor.canRead)throw new NoticeReviewError('notice_review_forbidden',403);
 const s=await noticeSource(tenant,bid,caseId);
 const proposals=await sql`SELECT review FROM product_recall_notice_reviews WHERE tenant_id=${s.batch.tenant_id}::uuid AND batch_id=${s.batch.id}::uuid AND case_id=${caseId}::uuid ORDER BY created_at DESC,id DESC LIMIT 21`;
 const history=await sql`SELECT id::text,proposal_id::text,actor_id::text,actor_label,action,created_at,
 result#>>'{review,version}' AS version,result#>>'{review,kind}' AS kind,result#>>'{review,state}' AS state,command->>'reason' AS reason,
 result#>>'{review,evidenceReference}' AS evidence_reference FROM product_recall_notice_operations
 WHERE tenant_id=${s.batch.tenant_id}::uuid AND case_id=${caseId}::uuid ORDER BY created_at DESC,id DESC LIMIT 101`;
 return {ok:true,protocol:'nexid.recall-notice-workspace.v1',source:'database',scope:{tenant,bid,tenantId:s.batch.tenant_id,batchId:s.batch.id,caseId},product:s.batch.product_name,tenantName:s.batch.tenant_name,current:s.current,kind:s.kind,resolutionMessage:s.resolutionMessage,effectiveAt:s.effectiveAt,observedAt:s.observedAt,actor,proposals:proposals.slice(0,20).map(p=>p.review),hasMore:proposals.length>20,history:history.slice(0,100),historyTruncated:history.length>100};
}
export async function mutateNotice(tenant:string,bid:string,caseId:string,actor:NoticeActor,action:string,raw:unknown){
 const command=parseNoticeReviewCommand(action,raw);if(command.caseId!==caseId)throw new NoticeReviewError('notice_review_scope_mismatch',403);
 const s=await noticeSource(tenant,bid,caseId);authorizeNoticeReview(actor,s.current,action);
 // Resolve durable receipt before interpreting the now potentially advanced source/proposal.
 const receipts=await sql`SELECT command=${JSON.stringify(command)}::jsonb AS same_command,result FROM product_recall_notice_operations
 WHERE tenant_id=${s.batch.tenant_id}::uuid AND batch_id=${s.batch.id}::uuid AND actor_id=${actor.id}::uuid AND operation_id=${command.operationId}::uuid LIMIT 1`;
 if(receipts[0]){if(!receipts[0].same_command)throw new NoticeReviewError('notice_review_idempotency_conflict',409);const result=receipts[0].result as any;return {ok:true,protocol:'nexid.recall-notice-workspace.v1',scope:{tenant,bid,tenantId:s.batch.tenant_id,batchId:s.batch.id,caseId},...result,receipt:{...result.receipt,replayed:true}};}
 const rows=await sql`SELECT review FROM product_recall_notice_reviews WHERE id=${command.proposalId}::uuid AND tenant_id=${s.batch.tenant_id}::uuid AND batch_id=${s.batch.id}::uuid AND case_id=${caseId}::uuid LIMIT 1`;
 const review=rows[0]?.review||null;
 const plan=planNoticeReview({current:s.current,review,actor,action,body:raw,now:s.observedAt});
 const output=await sql`SELECT public.nexid_recall_notice_commit_v1(${s.batch.tenant_id}::uuid,${s.batch.id}::uuid,${actor.id}::uuid,${actor.label},${JSON.stringify(command)}::jsonb,${JSON.stringify({...plan,previousReview:review})}::jsonb) AS result`;
 const result=output[0]?.result as any;if(!result?.receipt?.committed||!result.review)throw new NoticeReviewError('notice_review_receipt_unconfirmed',503);
 return {ok:true,protocol:'nexid.recall-notice-workspace.v1',scope:{tenant,bid,tenantId:s.batch.tenant_id,batchId:s.batch.id,caseId},...result};
}
export function noticeFailure(error:unknown){if(error instanceof NoticeReviewError||error instanceof RecallError)return {reason:error.code,status:error.status};const message=error instanceof Error?error.message:'';if(/^notice_review_[a-z_]+$/.test(message))return {reason:message,status:/forbidden|independent/.test(message)?403:/not_found/.test(message)?404:409};return {reason:'notice_review_unavailable',status:503};}
export async function publicNoticesV2(tenant:string,bid:string){
 if(!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant)||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid))throw new NoticeReviewError('notice_review_scope_required',400);
 const rows=await sql`SELECT b.id,
 (SELECT count(*)::int FROM product_recall_cases c WHERE c.tenant_id=b.tenant_id AND c.batch_id=b.id AND c.published_at IS NOT NULL) AS total,
 (SELECT coalesce(jsonb_agg(n.notice ORDER BY n.rank,n.published_at DESC),'[]'::jsonb) FROM(
 SELECT CASE WHEN h.state='lifted' THEN 1 ELSE 0 END rank,c.published_at,jsonb_build_object('id',c.id,'kind',c.document->>'kind',
 'title',coalesce(h.notice->>'title',c.document->>'title'),'message',coalesce(h.notice->>'publicMessage',c.document->>'publicMessage'),
 'instructions',coalesce(h.notice->>'instructions',c.document->>'instructions'),'contact',coalesce(h.notice->>'contact',c.document->>'contact'),
 'publishedAt',c.published_at,'trackingState',c.state,'noticeState',coalesce(h.state,'active'),'noticeVersion',coalesce(h.notice_version,1),
 'effectiveAt',coalesce(h.effective_at,c.published_at),'resolutionMessage',h.resolution_message) AS notice
 FROM product_recall_cases c LEFT JOIN product_recall_notice_heads h ON h.case_id=c.id AND h.tenant_id=c.tenant_id
 WHERE c.tenant_id=b.tenant_id AND c.batch_id=b.id AND c.published_at IS NOT NULL ORDER BY rank,c.published_at DESC,c.id LIMIT 20) n) AS notices
 FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE b.bid=${bid} AND t.slug=${tenant} LIMIT 2`;
 if(rows.length!==1)throw new NoticeReviewError('notice_review_case_not_found',404);
 const r=rows[0];return {ok:true,protocol:'nexid.product-notices.v2',scope:{tenant,bid},observedAt:new Date().toISOString(),notices:r.notices,total:r.total,hasMore:Number(r.total)>20,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true};
}
