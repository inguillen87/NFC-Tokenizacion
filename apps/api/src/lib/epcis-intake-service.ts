import {sql} from './db';
import {captureEpcisOperatorDocument,EpcisError} from './epcis';
import {resolveTenantGs1Identities,gs1IdentityKey,Gs1RegistryError} from './gs1-digital-link-registry';
import {INTAKE_PROTOCOL,IntakeError,intakeDocument,intakeReference,digest,UUID} from './epcis-intake-policy';
export async function intakeScope(tenant:string,bid:string){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid))throw new IntakeError('intake_batch_invalid');
 const rows=await sql`SELECT b.id::text batch_id,b.bid,t.id::text tenant_id,t.slug tenant,b.carrier_profile_code carrier,coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') product FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE b.bid=${bid} AND (${tenant}='' OR t.slug=${tenant}) ORDER BY b.id LIMIT 2`;
 if(rows.length!==1)throw new IntakeError(rows.length?'intake_batch_ambiguous':'intake_batch_not_found',rows.length?409:404);
 const row=rows[0];return {tenant:row.tenant,tenantId:row.tenant_id,batchId:row.batch_id,bid:row.bid,carrier:row.carrier,product:row.product};
}
function receipt(row:any){return {captureId:row.id,documentRecordId:row.document_record_id,reference:row.operator_context.reference,operationId:String(row.idempotency_key).split(':').at(-1),eventCount:Number(row.event_count),projectionCount:Number(row.canonical_projection_count),at:new Date(row.captured_at).toISOString(),actorId:row.actor_user_id,documentDigest:row.operator_context.documentDigest,replayed:false,evidence:'declared_business_event'};}
export async function intakeBoard(tenant:string,bid:string,actorId:string){
 const scope=await intakeScope(tenant,bid);
 const identities=await sql`SELECT id::text,gtin,lot,serial FROM gs1_digital_link_identities WHERE tenant_id=${scope.tenantId}::uuid AND batch_id=${scope.batchId}::uuid AND status='active' ORDER BY gtin,lot,serial LIMIT 100`;
 const rows=await sql`SELECT (SELECT count(*)::int FROM gs1_digital_link_identities i WHERE i.tenant_id=${scope.tenantId}::uuid AND i.batch_id=${scope.batchId}::uuid AND i.status='active') identity_count,
 coalesce((SELECT jsonb_agg(r ORDER BY r.captured_at DESC) FROM (SELECT c.id::text,c.actor_user_id::text,c.idempotency_key,c.operator_context,c.event_count,c.canonical_projection_count,c.captured_at,d.id::text document_record_id FROM epcis_capture_operations c JOIN epcis_documents d ON d.capture_operation_id=c.id AND d.tenant_id=c.tenant_id WHERE c.tenant_id=${scope.tenantId}::uuid AND c.actor_user_id=${actorId}::uuid AND c.operator_context->>'batchId'=${scope.batchId} ORDER BY c.captured_at DESC LIMIT 15) r),'[]'::jsonb) receipts`;
 return {ok:true,protocol:INTAKE_PROTOCOL,source:'database',scope,observedAt:new Date().toISOString(),identityCount:rows[0].identity_count,identities,receipts:rows[0].receipts.map(receipt)};
}
export async function previewIntake(tenant:string,bid:string,raw:unknown){
 const validated=intakeDocument(raw),scope=await intakeScope(tenant,bid);
 const registry=await resolveTenantGs1Identities(scope.tenantId,validated.events.flatMap(e=>e.identities));
 const events=validated.events.map((event,index)=>{
  const links=event.identities.map(i=>registry.get(gs1IdentityKey(i))!);
  if(!links.some(i=>i.batchId===scope.batchId))throw new IntakeError('intake_event_not_linked_to_selected_batch',422,index+1);
  return {row:index+1,id:event.client_event_id,type:event.event_type,time:event.event_time,action:event.action||'',step:event.biz_step||'',identities:links.map(i=>({id:i.id,bid:i.bid,gtin:i.gtin,lot:i.lot,serial:i.serial}))};
 });
 const ids=events.map(e=>e.id);
 const conflicts=await sql`SELECT client_event_id FROM epcis_events WHERE tenant_id=${scope.tenantId}::uuid AND client_event_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) ORDER BY client_event_id LIMIT 50`;
 const endpoints=await sql`SELECT count(*)::int n FROM webhook_endpoints WHERE tenant_id=${scope.tenantId}::uuid AND enabled=true AND deleted_at IS NULL AND (events ? 'epcis.event.captured' OR events ? '*')`;
 const existing=new Set(conflicts.map(r=>r.client_event_id));
 return {ok:true,protocol:INTAKE_PROTOCOL,source:'database',scope,previewDigest:digest({scope:scope.batchId,tenant:scope.tenantId,document:validated.document,identities:events.map(e=>e.identities.map(i=>i.id))}),documentDigest:digest(validated.document),eventCount:events.length,projectionCount:validated.projectionCount,webhookEndpoints:Math.min(Number(endpoints[0].n),25),ready:existing.size===0,events:events.map(e=>({...e,existing:existing.has(e.id)}))};
}
export async function commitIntake(tenant:string,bid:string,actorId:string,raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new IntakeError('intake_command_invalid');
 const body=raw as Record<string,any>;
 if(Object.keys(body).some(k=>!['document','operationId','previewDigest','reference','confirmBid'].includes(k))||!UUID.test(body.operationId||''))throw new IntakeError('intake_command_invalid');
 const scope=await intakeScope(tenant,bid),reference=intakeReference(body.reference),validated=intakeDocument(body.document),documentDigest=digest(validated.document);
 if(body.confirmBid!==bid)throw new IntakeError('intake_explicit_confirmation_required');
 const context={origin:'operator_import',batchId:scope.batchId,documentDigest,reference};
 const key='operator:'+actorId+':'+body.operationId;
 await sql`SELECT public.nexid_epcis_require_operator_v1(${scope.tenantId}::uuid,${actorId}::uuid)`;
 const prior=await sql`SELECT c.id::text,c.actor_user_id::text,c.idempotency_key,c.operator_context,c.event_count,c.canonical_projection_count,c.captured_at,d.id::text document_record_id FROM epcis_capture_operations c JOIN epcis_documents d ON d.capture_operation_id=c.id AND d.tenant_id=c.tenant_id WHERE c.tenant_id=${scope.tenantId}::uuid AND c.actor_user_id=${actorId}::uuid AND c.idempotency_key=${key} LIMIT 1`;
 if(prior[0]){if(digest(prior[0].operator_context)!==digest(context))throw new IntakeError('intake_operation_payload_conflict',409);return {ok:true,protocol:INTAKE_PROTOCOL,scope,receipt:{...receipt(prior[0]),replayed:true}};}
 const preview=await previewIntake(tenant,bid,body.document);
 if(body.previewDigest!==preview.previewDigest)throw new IntakeError('intake_preview_changed',409);
 const captured=await captureEpcisOperatorDocument({tenantId:scope.tenantId,actorUserId:actorId,idempotencyKey:key,document:validated.document,operatorContext:context});
 return {ok:true,protocol:INTAKE_PROTOCOL,scope,receipt:{captureId:captured.captureId,documentRecordId:captured.documentRecordId,reference,operationId:body.operationId,eventCount:captured.eventCount,projectionCount:captured.canonicalProjectionCount,at:new Date(captured.capturedAt).toISOString(),actorId,documentDigest,replayed:captured.replayed,evidence:'declared_business_event'}};
}
export function intakeFailure(error:unknown){
 if(error instanceof IntakeError)return {reason:error.code,status:error.status,row:error.row};
 if(error instanceof EpcisError||error instanceof Gs1RegistryError)return {reason:error.code,status:error.status};
 if(error instanceof SyntaxError)return {reason:'intake_json_invalid',status:400};
 return {reason:'intake_temporarily_unavailable',status:503};
}
