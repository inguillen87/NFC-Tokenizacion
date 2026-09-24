import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSupplierCancellation,supplierCancellationCall} from '../src/lib/supplier-request-cancellation-client.ts';
import {parseSupplierRequestRecord,filterSupplierRequestInbox,SupplierRequestError}from'../src/lib/supplier-request-client.ts';
const id='40000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001';
const scope={id,tenantId,tenant:'qa-only'},command={key,body:{expected_revision:2,expected_review_revision:0,reason:'Cambio comercial.'}};
const row=(patch={})=>({id,tenant_id:tenantId,tenant_slug:'qa-only',title:'Solicitud QA',notes:'Original inmutable',construction_id:'tt_bridge',quantity:125,pack_purpose:'production',status:'submitted',revision:2,created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-23T12:01:00.000Z',submitted_at:'2026-09-23T12:01:00.000Z',order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},...patch});
const cancelled=(patch={})=>row({status:'cancelled',revision:3,cancellation_reason:command.body.reason,cancelled_by:actor,cancelled_at:'2026-09-24T12:00:00.000Z',updated_at:'2026-09-24T12:00:00.000Z',...patch});
const envelope=(patch={})=>({ok:true,protocol:'nexid.supplier-request-cancellation.v1',available:true,scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request:row(),...patch});
const receipt=(patch={})=>envelope({request:cancelled(),receipt:{idempotency_key:key,action:'cancel',revision:3},idempotent_replay:false,...patch});
const response=(body,status=200,headers={})=>Response.json(body,{status,headers:{'x-nexid-data-mode':'production',...headers}});
const call=(body,cmd=command,status=200,headers={})=>supplierCancellationCall({...scope,command:cmd},async()=>response(body,status,headers));
test('snapshot and terminal record preserve source fields, history summary and cancellation metadata',()=>{
 assert.deepEqual(parseSupplierCancellation(envelope(),scope),{request:row()});assert.equal(parseSupplierCancellation(receipt(),scope,command).receipt.action,'cancel');
 assert.equal(filterSupplierRequestInbox([row(),cancelled({id:key})],'','cancelled').length,1);
 assert.equal(parseSupplierRequestRecord({...row(),cancellation_reason:null,cancelled_at:null,cancelled_by:null}).status,'submitted');
});
for(const patch of [{ok:false},{available:false},{protocol:'wrong'},{demo:true},{demoMode:true},{dataSource:'demo'},{scope:{mode:'global',tenant_id:null,tenant_slug:null}},{scope:{mode:'tenant',tenant_id:key,tenant_slug:'qa-only'}},{scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'foreign'}}])test('rejects unconfirmed or cross-scope cancellation snapshot '+JSON.stringify(patch),()=>assert.throws(()=>parseSupplierCancellation(envelope(patch),scope)));
test('terminal record needs reason, operator, matching dates and no technical order',()=>{
 for(const patch of [{cancellation_reason:''},{cancellation_reason:' '},{cancellation_reason:'x'.repeat(2001)},{cancelled_by:'invalid'},{cancelled_at:null},{cancelled_at:'2026-09-23T12:00:00.000Z'},{order_id:key},{status:'submitted'}])assert.throws(()=>parseSupplierRequestRecord(cancelled(patch)));
});
test('exact cancellation receipt and immutable command are bound to both revisions',()=>{
 for(const patch of [{request:row()},{request:cancelled({revision:4})},{request:cancelled({id:key})},{request:cancelled({tenant_id:key})},{request:cancelled({cancellation_reason:'other'})},{request:cancelled({review_summary:{state:'answered',revision:2,updated_at:'2026-09-24T11:00:00.000Z'}})},{receipt:{idempotency_key:id,action:'cancel',revision:3}},{receipt:{idempotency_key:key,action:'submit',revision:3}},{receipt:{idempotency_key:key,action:'cancel',revision:2}},{idempotent_replay:undefined}])assert.throws(()=>parseSupplierCancellation(receipt(patch),scope,command));
});
test('transport uses same-origin bounded endpoint and sends one exact reviewed command',async()=>{
 let seen;const result=await supplierCancellationCall({...scope,command},async(url,init)=>{seen={url,init};return response(receipt());});assert.equal(result.request.status,'cancelled');
 assert.equal(seen.url,'/api/admin/supplier-requests/'+id+'/cancellation?tenant=qa-only');assert.equal(seen.init.method,'POST');assert.equal(seen.init.credentials,'same-origin');assert.equal(seen.init.cache,'no-store');assert.equal(seen.init.headers['Idempotency-Key'],key);assert.deepEqual(JSON.parse(seen.init.body),command.body);
 let count=0;await supplierCancellationCall(scope,async(url,init)=>{count++;assert.equal(init.method,'GET');assert.equal(init.body,undefined);return response(envelope());});assert.equal(count,1);
});
test('invalid scope or local command makes no network call',async()=>{
 for(const patch of [{tenant:'../bad'},{id:'bad'},{tenantId:'bad'},{command:{...command,key:'bad'}},{command:{...command,body:{...command.body,reason:' '}}},{command:{...command,body:{...command.body,expected_revision:0}}},{command:{...command,body:{...command.body,expected_review_revision:-1}}},{command:{...command,body:{...command.body,actor_id:actor}}}]){
  let calls=0;await assert.rejects(supplierCancellationCall({...scope,command,...patch},async()=>{calls++;throw Error();}),e=>e instanceof SupplierRequestError&&!e.uncertain);assert.equal(calls,0);
 }
});
for(const status of [400,401,403,404,409,429])test('trusted explicit '+status+' is not falsely reported as committed',async()=>{await assert.rejects(call({ok:false,reason:'supplier_request_scope_forbidden'},command,status),e=>e.status===status&&!e.uncertain);});
for(const status of [408,500,503])test('unconfirmed '+status+' preserves mutation uncertainty',async()=>{await assert.rejects(call({ok:false,reason:'synthetic_unavailable'},command,status),e=>e.uncertain);});
test('missing provenance, wrong MIME and invalid receipts are uncertain on writes but not reads',async()=>{
 for(const headers of [{'x-nexid-data-mode':'demo'},{'x-nexid-data-mode':''},{'content-type':'text/html'}])await assert.rejects(call(receipt(),command,200,headers),e=>e.uncertain);
 await assert.rejects(call(receipt({receipt:null})),e=>e.uncertain);
 await assert.rejects(call(envelope({available:false}),null),e=>!e.uncertain);
});
test('oversized streamed replies abort consumption and never confirm cancellation',async()=>{
 let cancelledStream=false,reads=0;const stream=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(32769));},cancel(){cancelledStream=true;}});
 await assert.rejects(supplierCancellationCall({...scope,command},async()=>new Response(stream,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.uncertain);assert.equal(cancelledStream,true);assert.ok(reads<=4);
});
test('invalid UTF8 and malformed responses are uncertain after a mutation',async()=>{
 for(const body of ['{invalid',new Uint8Array([0xff,0xfe])])await assert.rejects(supplierCancellationCall({...scope,command},async()=>new Response(body,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.uncertain);
});
test('caller abort is forwarded; network failure does not silently retry',async()=>{
 const controller=new AbortController();let calls=0,signal;
 const pending=supplierCancellationCall({...scope,command,signal:controller.signal},async(url,init)=>{calls++;signal=init.signal;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))));});controller.abort();await assert.rejects(pending,e=>e.uncertain);assert.equal(signal.aborted,true);assert.equal(calls,1);
});
