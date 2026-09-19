import {sql} from './db';
import {RecallError,recallId} from './recall-policy';
import {TASK_PROTOCOL,taskCommand,type TaskActor} from './recall-task-policy';
const iso=(value:any)=>value?new Date(value).toISOString():null;
function projectTask(row:any,actor:TaskActor){
 const p=row.progress||{},d=row.destination;
 return {caseId:String(row.case_id),destinationId:d.id,bid:row.bid,tenant:row.tenant_slug,tenantName:row.tenant_name,product:row.product,
  version:Number(row.version),state:row.state,kind:row.kind,publishedAt:iso(row.published_at),updatedAt:iso(row.updated_at),
  notice:{version:Number(row.notice_version||1),state:row.notice_state||'active',title:row.notice.title,message:row.notice.publicMessage,instructions:row.notice.instructions,contact:row.notice.contact,resolution:row.resolution_message||null},
  recipient:d.recipient,unitLabel:row.unit_label,assignedUnits:Number(d.units),returnedUnits:Number(p.returnedUnits||0),heldUnits:Number(p.heldUnits||0),
  acknowledgedAt:iso(p.acknowledgedAt),accountedAt:iso(p.accountedAt),acknowledgedBySelf:p.acknowledgedBy===actor.id,
  canAcknowledge:actor.canRespond&&row.state==='active'&&!p.acknowledgedAt,canAccount:actor.canRespond&&row.state==='active'&&Boolean(p.acknowledgedAt)};
}
export async function assignedTaskList(actor:TaskActor,includeClosed=false){
 if(!actor.canRead)throw new RecallError('recall_task_read_forbidden',403);recallId(actor.id);
 const rows=await sql`SELECT c.id::text case_id,c.version,c.state,c.document->>'kind' kind,c.document->>'unitLabel' unit_label,c.published_at,c.updated_at,
 b.bid,t.slug tenant_slug,t.name tenant_name,coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') product,d.value destination,c.progress->(d.value->>'id') progress,
 coalesce(h.notice,jsonb_build_object('title',c.document->'title','publicMessage',c.document->'publicMessage','instructions',c.document->'instructions','contact',c.document->'contact')) notice,h.notice_version,h.state notice_state,h.resolution_message
 FROM product_recall_cases c JOIN tenants t ON t.id=c.tenant_id JOIN batches b ON b.id=c.batch_id AND b.tenant_id=c.tenant_id
 CROSS JOIN LATERAL jsonb_array_elements(c.document->'destinations') d
 LEFT JOIN product_recall_notice_heads h ON h.case_id=c.id AND h.tenant_id=c.tenant_id
 WHERE c.published_at IS NOT NULL AND (c.state IN('active','closing') OR (${includeClosed} AND c.state='closed'))
 AND c.document->'destinations' @> ${JSON.stringify([{assigneeId:actor.id}])}::jsonb
 AND d.value->>'assigneeId'=${actor.id} AND (${actor.tenantId}::uuid IS NULL OR c.tenant_id=${actor.tenantId}::uuid)
 AND EXISTS(SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=${actor.id}::uuid AND u.admin_status='active' AND (m.tenant_id=c.tenant_id OR (m.tenant_id IS NULL AND m.role::text='super_admin')))
 ORDER BY c.updated_at DESC,c.id,d.value->>'id' LIMIT 51`;
 return {ok:true,protocol:TASK_PROTOCOL,source:'database',observedAt:new Date().toISOString(),actor:{id:actor.id,label:actor.label,canRespond:actor.canRespond},includeClosed,tasks:rows.slice(0,50).map(r=>projectTask(r,actor)),hasMore:rows.length>50,limit:50};
}
export async function assignedTaskDetail(actor:TaskActor,caseId:string,destinationId:string){
 if(!actor.canRead)throw new RecallError('recall_task_read_forbidden',403);recallId(actor.id);recallId(caseId);recallId(destinationId);
 const rows=await sql`SELECT c.id::text case_id,c.tenant_id::text,c.batch_id::text,c.version,c.state,c.document->>'kind' kind,c.document->>'unitLabel' unit_label,c.published_at,c.updated_at,
 b.bid,t.slug tenant_slug,t.name tenant_name,coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') product,d.value destination,c.progress->(d.value->>'id') progress,
 coalesce(h.notice,jsonb_build_object('title',c.document->'title','publicMessage',c.document->'publicMessage','instructions',c.document->'instructions','contact',c.document->'contact')) notice,h.notice_version,h.state notice_state,h.resolution_message,
 (SELECT coalesce(jsonb_agg(e.data ORDER BY e.created_at DESC,e.id DESC),'[]'::jsonb) FROM(
 SELECT o.id,o.created_at,jsonb_build_object('id',o.id,'action',o.action,'at',o.created_at,'actorLabel',o.actor_label,'bySelf',o.actor_id=${actor.id}::uuid,'source',CASE WHEN o.command->>'submissionSource'='assigned_task' THEN 'assigned_task' ELSE 'management_record' END,'reference',o.command->>'evidenceReference','reason',o.command->>'reason','returnedUnits',o.command->'returnedUnits','heldUnits',o.command->'heldUnits') data
 FROM product_recall_operations o WHERE o.case_id=c.id AND o.tenant_id=c.tenant_id AND o.command->>'destinationId'=${destinationId} AND o.action IN('acknowledge','account') ORDER BY o.created_at DESC,o.id DESC LIMIT 51) e) history
 FROM product_recall_cases c JOIN tenants t ON t.id=c.tenant_id JOIN batches b ON b.id=c.batch_id AND b.tenant_id=c.tenant_id
 CROSS JOIN LATERAL jsonb_array_elements(c.document->'destinations') d
 LEFT JOIN product_recall_notice_heads h ON h.case_id=c.id AND h.tenant_id=c.tenant_id
 WHERE c.id=${caseId}::uuid AND c.published_at IS NOT NULL AND c.state IN('active','closing','closed')
 AND d.value->>'id'=${destinationId} AND d.value->>'assigneeId'=${actor.id}
 AND (${actor.tenantId}::uuid IS NULL OR c.tenant_id=${actor.tenantId}::uuid)
 AND EXISTS(SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=${actor.id}::uuid AND u.admin_status='active' AND (m.tenant_id=c.tenant_id OR (m.tenant_id IS NULL AND m.role::text='super_admin'))) LIMIT 1`;
 if(!rows[0])throw new RecallError('recall_task_not_found',404);const row=rows[0] as any;
 return {internal:{tenantId:row.tenant_id,batchId:row.batch_id},public:{ok:true,protocol:TASK_PROTOCOL,source:'database',observedAt:new Date().toISOString(),actor:{id:actor.id,label:actor.label,canRespond:actor.canRespond},task:projectTask(row,actor),history:row.history.slice(0,50),historyTruncated:row.history.length>50,evidenceBasis:'assigned_account_declaration'}};
}
export async function respondAssignedTask(actor:TaskActor,caseId:string,destinationId:string,action:string,raw:unknown){
 if(!actor.canRespond)throw new RecallError('recall_task_respond_forbidden',403);
 const command=taskCommand(action,caseId,destinationId,raw),before=await assignedTaskDetail(actor,caseId,destinationId);
 const rows=await sql`SELECT public.nexid_recall_assignee_command_v1(${before.internal.tenantId}::uuid,${before.internal.batchId}::uuid,${actor.id}::uuid,${actor.label},${caseId}::uuid,${destinationId}::uuid,${JSON.stringify(command)}::jsonb) result`;
 const result=rows[0]?.result as any;if(!result?.receipt?.committed)throw new RecallError('recall_task_receipt_unconfirmed',503);
 // A read failure after commit is explicitly uncertain; retry uses the durable original receipt.
 const updated=await assignedTaskDetail(actor,caseId,destinationId);
 return {...updated.public,receipt:{...result.receipt,caseId,destinationId,caseVersion:result.caseVersion}};
}
