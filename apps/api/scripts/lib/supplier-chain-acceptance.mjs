import assert from 'node:assert/strict';
import {randomBytes, randomUUID, createHash} from 'node:crypto';

/** Production route handlers, local TCP and the complete migrated schema.
 * Only identities, commercial content and declared physical-test evidence are synthetic.
 * Never sends to a supplier or reads an application credential from disk.
 */
export async function supplierChainRoutes() {
 const routes=[];
 const root=await import('../../src/app/admin/supplier-requests/route.ts');
 for(const method of ['GET','POST']) routes.push({method,match:u=>u.pathname==='/admin/supplier-requests',handle:root[method]});
 for(const suffix of ['', '/submit','/review','/quotation','/supplier-binding','/delivery-ack','/cancellation']) {
  const module=await import(`../../src/app/admin/supplier-requests/[requestId]${suffix}/route.ts`);
  const pattern=new RegExp('^/admin/supplier-requests/([a-f0-9-]{36})'+suffix+'$','i');
  for(const method of ['GET','POST','PATCH']) if(module[method]) routes.push({method,match:u=>{const m=pattern.exec(u.pathname);return m?{requestId:m[1]}:null;},handle:(req,p)=>module[method](req,{params:Promise.resolve(p)})});
 }
 for(const suffix of ['export-pack','lifecycle']) {
  const module=await import(`../../src/app/admin/supplier-orders/[orderId]/${suffix}/route.ts`);
  const pattern=new RegExp('^/admin/supplier-orders/([a-f0-9-]{36})/'+suffix+'$','i');
  routes.push({method:'POST',match:u=>{const m=pattern.exec(u.pathname);return m?{orderId:m[1]}:null;},handle:(req,p)=>module.POST(req,{params:Promise.resolve(p)})});
 }
 const tickets=await import('../../src/app/admin/tickets/[id]/route.ts');
 const history=await import('../../src/app/admin/tickets/[id]/history/route.ts');
 for(const [suffix,method,module] of [['','PATCH',tickets],['/history','GET',history]]) {
  const pattern=new RegExp('^/admin/tickets/([a-f0-9-]{36})'+suffix+'$','i');
  routes.push({method,match:u=>{const m=pattern.exec(u.pathname);return m?{id:m[1]}:null;},handle:(req,p)=>module[method](req,{params:Promise.resolve(p)})});
 }
 return routes;
}

export async function runSupplierChainAcceptance(c) {
 const {client,httpHarness,tenantId,tenantSlug,adminHeaders,otherTenantAdminHeaders,superAdminHeaders,packagingApproverHeaders,packagingSpec,packagingEvidenceRefs}=c;
 const checks=[];
 function check(value,name){assert.ok(value,name);checks.push(name);}
 async function call(name,path,{method='GET',headers=superAdminHeaders,body,key=randomUUID(),status=200}={}) {
  const response=await httpHarness.fetch(path,{method,headers:{...headers,...(body?{'content-type':'application/json','idempotency-key':key}: {})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await response.json().catch(()=>({reason:'non_json_response'}));
  assert.equal(response.status,status,`${name}: ${String(payload.reason||'status_mismatch').slice(0,100)}`);
  checks.push(name);return payload;
 }
 const flags=['SUPPLIER_REQUEST_QUOTES_ENABLED','SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED','SUPPLIER_DELIVERY_ACK_ENABLED'];
 const previous=new Map(flags.map(k=>[k,process.env[k]]));
 for(const k of flags)process.env[k]='true';
 try {
  const create=await call('request draft persisted','/admin/supplier-requests?tenant='+tenantSlug,{method:'POST',headers:adminHeaders,status:201,body:{title:'Ephemeral integrated supplier chain',construction_id:'pet_wet',quantity:4,pack_purpose:'trial_integration',notes:'Synthetic commercial request; no physical order or purchase.'}});
  const id=create.request.id,path='/admin/supplier-requests/'+id,query='?tenant='+tenantSlug;
  let current=(await call('explicit request submission',path+'/submit'+query,{method:'POST',headers:adminHeaders,body:{expected_revision:create.request.revision}})).request;
  await call('foreign company denied before private request disclosure',path+query,{headers:otherTenantAdminHeaders,status:403});
  const ask=await call('clarification registered by NexID',path+'/review'+query,{method:'POST',body:{action:'request_information',expected_revision:0,expected_request_revision:current.revision,message:'Confirm the trial construction; synthetic QA.'}});
  await call('company clarification response',path+'/review'+query,{method:'POST',headers:adminHeaders,body:{action:'respond',expected_revision:ask.review.revision,expected_request_revision:current.revision,message:'Trial construction confirmed for software acceptance only.'}});
  current=(await call('request read after clarification',path+query)).request;
  const issued=await call('versioned quotation issued',path+'/quotation'+query,{method:'POST',body:{action:'issue',expected_revision:0,expected_request_revision:current.revision,expected_review_revision:current.review_summary.revision,offer:{currency:'USD',net_minor:10000,tax_minor:0,shipping_minor:0,valid_until:new Date(Date.now()+3600000).toISOString(),conditions:'Synthetic amount; no purchase, payment, tax advice or external delivery.'},reason:'Software acceptance quotation only.'}});
  current=issued.request;
  const technical=()=>({tenant:tenantSlug,customer_slug:tenantSlug,order_name:'Ephemeral integrated trial',base_batch_id:'E2E-SUPPLIER-CHAIN-001',total_quantity:4,sub_batch_size:4,chip_model:'NTAG424_DNA',carrier_profile_code:'ntag424_dna',pack_purpose:'trial_integration',material_type:'transparent_pet_wet_inlay',notes:'Synthetic local trial, not manufactured.',source_request_id:id,source_request_revision:current.revision});
  const notAccepted=await call('technical conversion blocked before buyer acceptance','/admin/supplier-orders',{method:'POST',body:technical(),status:409});
  check(notAccepted.reason==='supplier_request_quote_acceptance_required','quotation is an actual server-side conversion gate');
  const accepted=await call('buyer acceptance persisted',path+'/quotation'+query,{method:'POST',headers:adminHeaders,body:{action:'accept',expected_revision:issued.revision,expected_request_revision:current.revision,expected_review_revision:current.review_summary.revision,offer:null,reason:'Accepted for the isolated software test.'}});
  current=accepted.request;
  const converted=await call('real atomic request-to-order conversion','/admin/supplier-orders',{method:'POST',body:technical(),status:201});
  const orderId=converted.order.id,orderPath='/admin/supplier-orders/'+orderId;
  current=(await call('provisioned request bound to technical order',path+query)).request;
  check(current.status==='provisioned'&&current.order_id===orderId,'request and technical order agree');
  check(converted.sub_batches.length===1&&Number(converted.sub_batches[0].expected_quantity)===4,'one real technical sub-batch, not a fixture function');
  await call('duplicate conversion rejected','/admin/supplier-orders',{method:'POST',body:technical(),status:409});
  await call('packaging draft through real route',orderPath+'/packaging',{method:'POST',headers:adminHeaders,status:201,body:{status:'draft',spec:packagingSpec,evidence_refs:packagingEvidenceRefs}});
  await call('packaging submitted through real route',orderPath+'/packaging',{method:'POST',headers:adminHeaders,status:201,body:{status:'submitted'}});
  await call('packaging approved by separate identity',orderPath+'/packaging',{method:'POST',headers:packagingApproverHeaders,status:201,body:{status:'approved'}});
  const binding=await call('approved specification reconstructed from real decision',path+'/supplier-binding'+query);
  check(binding.specification.ready,'specification matches immutable approval receipt');
  const supplier={reference:'E2E-FACTORY-CHAIN',name:'Synthetic supplier, no contact',confirmation_ref:'E2E-SOFTWARE-CONFIRMATION'};
  const bindBody={action:'assign',expected_revision:binding.revision,expected_request_revision:current.revision,order_id:orderId,supplier,spec:{revision:binding.specification.revision,hash:binding.specification.hash,decision_id:binding.specification.decision_id},reason:'Local software acceptance; no real supplier confirmation.'};
  const assigned=await call('supplier bound to exact approved specification',path+'/supplier-binding'+query,{method:'POST',body:bindBody});
  const dispatchBody={transition:'mark_sent',recipient_ref:supplier.reference,delivery_channel:'secure_transfer',evidence_ref:'E2E-MANUAL-DISPATCH',reason:'Synthetic manual dispatch receipt, no actual supplier transfer.'};
  await call('dispatch forbidden before export exists',orderPath+'/lifecycle',{method:'POST',body:dispatchBody,status:409});
  const packPassword=randomBytes(36).toString('base64url');
  await call('tenant cannot export factory key material',orderPath+'/export-pack',{method:'POST',headers:adminHeaders,body:{password:packPassword},status:403});
  const pack=await call('actual encrypted package export',orderPath+'/export-pack',{method:'POST',body:{password:packPassword}});
  const bytes=Buffer.from(pack.encrypted_pack.base64,'base64');
  const digest='sha256:'+createHash('sha256').update(bytes).digest('hex');
  check(digest===pack.encrypted_pack.envelope_sha256,'exported envelope bytes match their hash');
  check(!JSON.stringify(pack).includes(packPassword),'generated password is absent from API response');
  const {decryptSupplierEncryptedZipForTest}=await import('../../src/lib/supplier-ops.ts');
  const plaintext=decryptSupplierEncryptedZipForTest(bytes,packPassword);
  check(Buffer.isBuffer(plaintext)&&plaintext.readUInt32LE(0)===0x04034b50,'real AES-GCM envelope decrypts to a ZIP in test memory');
  check('sha256:'+createHash('sha256').update(plaintext).digest('hex')===pack.encrypted_pack.plaintext_zip_sha256,'decrypted archive matches export digest');
  plaintext.fill(0);bytes.fill(0);
  const persisted=(await client.query("SELECT id,content_hash,metadata_json->>'envelope_sha256' envelope_hash FROM vault_artifacts WHERE supplier_order_id=$1 AND artifact_type='supplier_pack_zip_encrypted'",[orderId])).rows;
  check(persisted.length===1&&persisted[0].content_hash===digest&&persisted[0].envelope_hash===digest,'export persists one recoverable encrypted artifact');
  await call('second export blocked by one-time gate',orderPath+'/export-pack',{method:'POST',body:{password:packPassword},status:409});
  await call('wrong supplier recipient cannot be dispatched',orderPath+'/lifecycle',{method:'POST',body:{...dispatchBody,recipient_ref:'E2E-FOREIGN-SUPPLIER'},status:409});
  const dispatched=await call('actual lifecycle dispatch creates receipt',orderPath+'/lifecycle',{method:'POST',body:dispatchBody});
  const ack=await call('documentary acknowledgement reads real export',path+'/delivery-ack'+query);
  check(ack.source.dispatch_id===dispatched.receipt.id&&ack.source.binding_id===assigned.current.id,'dispatch and acknowledgement link same supplier binding');
  check(ack.artifacts.length===1&&ack.artifacts[0].id===persisted[0].id&&ack.artifacts[0].hash===digest,'acknowledgement selects the actual encrypted export');
  const ackBody={action:'received',expected_revision:0,expected_request_revision:current.revision,order_id:orderId,dispatch_id:dispatched.receipt.id,binding_id:assigned.current.id,artifact_id:persisted[0].id,artifact_hash:digest,reported_hash:digest,evidence_ref:'E2E-DOCUMENTARY-ACK',reason:'Synthetic NexID declaration only; no supplier identity or physical delivery.'};
  await call('company cannot write documentary acknowledgement',path+'/delivery-ack'+query,{method:'POST',headers:adminHeaders,body:ackBody,status:403});
  const operation=randomUUID();
  const saved=await call('documentary acknowledgement persisted',path+'/delivery-ack'+query,{method:'POST',body:ackBody,key:operation});
  const replay=await call('lost-response retry returns original acknowledgement',path+'/delivery-ack'+query,{method:'POST',body:ackBody,key:operation});
  check(replay.idempotent_replay&&replay.receipt.event_id===saved.receipt.event_id,'retry commits no second acknowledgement');
  check(['supplier_authenticated','download_verified','decryption_verified','physical_received'].every(k=>saved.current[k]===false),'software evidence never claims physical or authenticated supplier receipt');
  await call('reassignment closed after dispatch',path+'/supplier-binding'+query,{method:'POST',body:{...bindBody,expected_revision:1},status:409});
  process.env.SUPPLIER_DELIVERY_ACK_ENABLED='false';
  await call('ack write switch disables changes',path+'/delivery-ack'+query,{method:'POST',body:{...ackBody,action:'issue',reported_hash:null,expected_revision:1},status:503});
  const off=await call('history remains readable with writes disabled',path+'/delivery-ack'+query,{headers:adminHeaders});
  check(off.history.length===1&&!off.writes_enabled,'disabled rollout preserves truthful history');
  const graph=(await client.query(`SELECT
    (SELECT count(*)::integer FROM supplier_orders WHERE id=$1) orders,
    (SELECT count(*)::integer FROM supplier_order_lifecycle_receipts WHERE supplier_order_id=$1) dispatches,
    (SELECT count(*)::integer FROM supplier_delivery_ack_events WHERE order_id=$1) acknowledgements,
    (SELECT count(*)::integer FROM supplier_request_quote_events WHERE request_id=$2) quotations,
    (SELECT count(*)::integer FROM supplier_request_review_events WHERE request_id=$2) clarifications,
    (SELECT bool_and(export_count=1) FROM batch_keys WHERE supplier_order_id=$1) one_time_export
  `,[orderId,id])).rows[0];
  check(graph.orders===1&&graph.dispatches===1&&graph.acknowledgements===1&&graph.quotations===2&&graph.clarifications===2&&graph.one_time_export,'entire durable graph agrees without duplicated keys, orders or receipts');
  const ticketId=randomUUID();
  await client.query("INSERT INTO tickets(id,tenant_id,contact,title,status,source,updated_at) VALUES($1,$2,'synthetic@nexid.invalid','Ephemeral workflow type compatibility','open','sun_public_report',clock_timestamp())",[ticketId,tenantId]);
  const ticketPath='/admin/tickets/'+ticketId;
  const originalTicket=await call('enum-backed ticket history read',ticketPath+'/history'+query,{headers:adminHeaders});
  const ticketOperation=randomUUID();
  const ticketBody={status:'pending',reason:'Synthetic typed-status support review.',request_id:ticketOperation,expected_revision:originalTicket.current.revision};
  const changed=await call('enum-backed ticket update committed',ticketPath+query,{method:'PATCH',headers:adminHeaders,body:ticketBody,key:ticketOperation});
  check(changed.current.status==='pending'&&changed.receipt.toStatus==='pending','typed status transition agrees with immutable receipt');
  const ticketRetry=await call('enum-backed ticket retry returns original receipt',ticketPath+query,{method:'PATCH',headers:adminHeaders,body:ticketBody,key:ticketOperation});
  check(ticketRetry.outcome==='replayed'&&ticketRetry.receipt.operationId===changed.receipt.operationId,'support retry does not duplicate an enum-backed transition');
  await call('foreign tenant cannot read support history',ticketPath+'/history'+query,{headers:otherTenantAdminHeaders,status:404});
  const type=(await client.query("SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='status'")).rows[0]?.udt_name;
  check(type==='ticket_status','full schema retains its original enum; no column coercion or permissive replacement');
  return {status:'passed',checks,counts:graph,request_conversion:'real_function',packaging_decisions:'real_routes_distinct_identities',encrypted_export:'real_exporter_and_memory_only_decrypt',ticket_status_type:type,external_supplier_contact:false,physical_evidence:'synthetic_declared_test_input',database_role:'dedicated_ephemeral_owner_not_production_role'};
 } finally {
  for(const [key,value] of previous) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
}
