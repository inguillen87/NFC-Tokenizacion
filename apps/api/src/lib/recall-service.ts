import {sql} from './db';
import {RECALL_PROTOCOL,RecallError,recallId,recallCommand,recallTotals,requireRecallAction,type RecallAction,type RecallActor,type RecallDocument} from './recall-policy';
export async function recallBatch(tenant:string,bid:string){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid)||!tenant||!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant))throw new RecallError('recall_scope_required',400);
 const rows=await sql`SELECT b.id::text,b.bid,t.id::text AS tenant_id,t.slug AS tenant_slug,t.name AS tenant_name,b.status::text AS status,
 coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') AS product_name,
 (SELECT count(*)::int FROM tags WHERE batch_id=b.id AND status='active') AS active_tags
 FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE b.bid=${bid} AND t.slug=${tenant} LIMIT 2`;
 if(rows.length!==1)throw new RecallError(rows.length?'recall_ambiguous_batch':'recall_batch_not_found',rows.length?409:404);
 return rows[0] as any;
}
export function recallCase(row:any){return {...row,id:String(row.id),tenant_id:String(row.tenant_id),batch_id:String(row.batch_id),version:Number(row.version),document:row.document as RecallDocument,progress:row.progress||{},totals:recallTotals(row.document,row.progress||{})};}
export async function recallBoard(tenant:string,bid:string,actor:RecallActor){
 if(!actor.canRead)throw new RecallError('recall_read_forbidden',403);
 const b=await recallBatch(tenant,bid);
 const cases=await sql`SELECT id::text,state,version,document->>'kind' AS kind,document->>'title' AS title,created_at,updated_at,published_at,closed_at
 FROM product_recall_cases WHERE tenant_id=${b.tenant_id}::uuid AND batch_id=${b.id}::uuid ORDER BY created_at DESC,id DESC LIMIT 31`;
 const members=await sql`SELECT DISTINCT u.id::text,coalesce(nullif(u.full_name,''),'Usuario de la empresa') AS label FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.tenant_id=${b.tenant_id}::uuid AND u.admin_status='active' ORDER BY label,1 LIMIT 100`;
 return {ok:true,protocol:RECALL_PROTOCOL,source:'database',observedAt:new Date().toISOString(),scope:{tenantId:b.tenant_id,tenant:b.tenant_slug,batchId:b.id,bid:b.bid},product:b.product_name,tenantName:b.tenant_name,activeTags:b.active_tags,batchStatus:b.status,actor,cases:cases.slice(0,30),hasMore:cases.length>30,members};
}
export async function recallDetail(tenant:string,bid:string,id:string,actor:RecallActor,exporting=false){
 if(!actor.canRead||(exporting&&!actor.canExport))throw new RecallError('recall_read_forbidden',403);
 const b=await recallBatch(tenant,bid);recallId(id);
 const rows=await sql`SELECT to_jsonb(c) AS record,
 (SELECT jsonb_build_object('version',h.notice_version,'state',h.state,'notice',h.notice,'resolutionMessage',h.resolution_message,'effectiveAt',h.effective_at) FROM product_recall_notice_heads h WHERE h.case_id=c.id AND h.tenant_id=c.tenant_id) AS effective_notice,
 (SELECT coalesce(jsonb_agg(h.data ORDER BY h.version),'[]'::jsonb) FROM (
 SELECT (o.result->>'version')::int AS version,jsonb_build_object('id',o.id,'at',o.created_at,'actorId',o.actor_id,'actorLabel',o.actor_label,'action',o.action,'version',(o.result->>'version')::int,'reason',o.command->>'reason','evidenceReference',o.command->>'evidenceReference','submissionSource',coalesce(o.command->>'submissionSource','management_record'),'destinationId',o.command->>'destinationId','returnedUnits',o.command->'returnedUnits','heldUnits',o.command->'heldUnits') AS data
 FROM product_recall_operations o WHERE o.case_id=c.id AND o.tenant_id=c.tenant_id ORDER BY (o.result->>'version')::int DESC LIMIT 500) h) AS history,
 (SELECT count(*)::int FROM product_recall_operations o WHERE o.case_id=c.id AND o.tenant_id=c.tenant_id) AS operation_count
 FROM product_recall_cases c WHERE id=${id}::uuid AND tenant_id=${b.tenant_id}::uuid AND batch_id=${b.id}::uuid LIMIT 1`;
 if(!rows[0])throw new RecallError('recall_case_not_found',404);
 const r=rows[0] as any;
 return {ok:true,protocol:RECALL_PROTOCOL,source:'database',observedAt:new Date().toISOString(),scope:{tenantId:b.tenant_id,tenant:b.tenant_slug,batchId:b.id,bid:b.bid},product:b.product_name,tenantName:b.tenant_name,actor,case:recallCase(r.record),effectiveNotice:r.effective_notice||null,history:r.history,historyTruncated:r.operation_count>500,operationCount:r.operation_count,evidenceBasis:'operator_declared',scopeCoverage:'whole_batch_warning_with_declared_follow_up_targets'};
}
export async function mutateRecall(tenant:string,bid:string,actor:RecallActor,action:RecallAction,body:unknown){
 requireRecallAction(actor,action);recallId(actor.id);const cmd=recallCommand(action,body),b=await recallBatch(tenant,bid);
 const rows=await sql`SELECT public.nexid_recall_command_v1(${b.tenant_id}::uuid,${b.id}::uuid,${actor.id}::uuid,${actor.label},${cmd.caseId}::uuid,${JSON.stringify(cmd)}::jsonb) AS result`;
 const value=rows[0]?.result as any;if(!value?.case||!value.receipt?.committed)throw new RecallError('recall_receipt_unconfirmed',503);
 return {ok:true,protocol:RECALL_PROTOCOL,scope:{tenantId:b.tenant_id,tenant:b.tenant_slug,batchId:b.id,bid:b.bid},case:recallCase(value.case),receipt:value.receipt};
}
export async function publicRecallNotices(tenant:string,bid:string){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid)||!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant))throw new RecallError('recall_scope_required',400);
 const rows=await sql`SELECT b.id,b.bid,t.slug,
 (SELECT count(*)::int FROM product_recall_cases c WHERE c.tenant_id=b.tenant_id AND c.batch_id=b.id AND c.published_at IS NOT NULL) AS total,
 (SELECT coalesce(jsonb_agg(n.notice ORDER BY n.published_at DESC),'[]'::jsonb) FROM (
 SELECT c.published_at,jsonb_build_object('id',c.id,'kind',c.document->>'kind','title',coalesce(h.notice->>'title',c.document->>'title'),'message',coalesce(h.notice->>'publicMessage',c.document->>'publicMessage'),'instructions',coalesce(h.notice->>'instructions',c.document->>'instructions'),'contact',coalesce(h.notice->>'contact',c.document->>'contact'),'publishedAt',c.published_at,'trackingState',c.state) AS notice
 FROM product_recall_cases c LEFT JOIN product_recall_notice_heads h ON h.case_id=c.id AND h.tenant_id=c.tenant_id WHERE c.tenant_id=b.tenant_id AND c.batch_id=b.id AND c.published_at IS NOT NULL ORDER BY c.published_at DESC,c.id LIMIT 20) n) AS notices
 FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE b.bid=${bid} AND t.slug=${tenant} LIMIT 2`;
 if(rows.length!==1)throw new RecallError('recall_batch_not_found',404);
 const r=rows[0];return {ok:true,protocol:'nexid.product-notices.v1',scope:{tenant,bid},observedAt:new Date().toISOString(),notices:r.notices,total:r.total,hasMore:Number(r.total)>20,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true};
}
