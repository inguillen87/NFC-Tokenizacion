import assert from 'node:assert/strict';import test from 'node:test';
import{parseSupplierQuote,supplierQuoteCall}from'../src/lib/supplier-request-quote-client.ts';
import{SupplierRequestError}from'../src/lib/supplier-request-client.ts';
const id='40000000-0000-4000-8000-000000000001',tenantId='10000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001';
const scope={id,tenantId,tenant:'qa-only'},offer={currency:'USD',net_minor:10001,tax_minor:2100,shipping_minor:499,conditions:'Condiciones declaradas.',valid_until:'2026-10-01T12:00:00.000Z'};
const command={key,body:{action:'issue',expected_revision:0,expected_request_revision:2,expected_review_revision:0,offer,reason:'Propuesta inicial.'}};
const event=(patch={})=>({...offer,id:key,revision:1,request_revision:3,quote_version:1,source_request_revision:2,review_revision:0,action:'issue',state:'offered',total_minor:12600,reason:command.body.reason,actor_id:actor,created_at:'2026-09-24T12:00:00.000Z',...patch});
const row=(patch={})=>({id,tenant_id:tenantId,tenant_slug:'qa-only',title:'Solicitud QA',notes:'Original',construction_id:'tt_bridge',quantity:125,pack_purpose:'production',status:'submitted',revision:3,quotation_revision:1,quotation_state:'offered',created_at:'2026-09-23T12:00:00.000Z',updated_at:'2026-09-24T12:00:00.000Z',submitted_at:'2026-09-23T12:01:00.000Z',order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},...patch});
const envelope=(patch={})=>({ok:true,protocol:'nexid.supplier-quote.v1',writes_enabled:true,scope:{mode:'tenant',tenant_id:tenantId,tenant_slug:'qa-only'},request:row(),revision:1,current:event(),history:[event()],count:1,truncated:false,next_before_revision:null,as_of:'2026-09-24T12:00:01.000Z',...patch});
const result=(patch={})=>envelope({receipt:{idempotency_key:key,action:'issue',revision:1,request_revision:3,quote_version:1},idempotent_replay:false,...patch});
const response=(body,status=200,headers={})=>Response.json(body,{status,headers:{'x-nexid-data-mode':'production',...headers}});
const call=(body,cmd=command,status=200,headers={})=>supplierQuoteCall({...scope,command:cmd},async()=>response(body,status,headers));
test('quote read retains exact source fields and immutable versions; it remains readable with write flag off',()=>{assert.equal(parseSupplierQuote(envelope(),scope).current.total_minor,12600);assert.equal(parseSupplierQuote(envelope({writes_enabled:false}),scope).writes_enabled,false);assert.equal(parseSupplierQuote(result(),scope,command).receipt.revision,1);});
for(const patch of [{protocol:'unknown'},{ok:false},{writes_enabled:null},{demo:true},{demoMode:true},{dataSource:'demo'},{scope:{mode:'global',tenant_id:null,tenant_slug:null}},{scope:{mode:'tenant',tenant_id:key,tenant_slug:'qa-only'}}])test('rejects untrusted quote envelope '+JSON.stringify(patch),()=>assert.throws(()=>parseSupplierQuote(envelope(patch),scope)));
test('quote receipt binds revisions, action, reason, exact terms and the source request',()=>{
 for(const patch of [{request:row({id:key})},{request:row({quotation_state:'accepted'})},{request:row({quotation_revision:0,quotation_state:null})},{request:row({status:'draft',submitted_at:null})},{receipt:{...result().receipt,idempotency_key:id}},{receipt:{...result().receipt,action:'accept'}},{receipt:{...result().receipt,request_revision:2}},{idempotent_replay:undefined},{current:event({net_minor:1,total_minor:2600}),history:[event({net_minor:1,total_minor:2600})]},{current:event({reason:'Different'}),history:[event({reason:'Different'})]}])assert.throws(()=>parseSupplierQuote(result(patch),scope,command));
});
test('old receipt replay may show a later quote without pretending the receipt belongs to that version',()=>{
 const later=event({id:actor,revision:2,request_revision:4,quote_version:2,source_request_revision:3,net_minor:20000,total_minor:22599});
 const current=result({request:row({revision:4,quotation_revision:2}),revision:2,current:later,history:[event(),later],count:2,idempotent_replay:true});
 const parsed=parseSupplierQuote(current,scope,command);assert.equal(parsed.receipt.quote_version,1);assert.equal(parsed.current.quote_version,2);assert.equal(parsed.current.total_minor,22599);
});
test('bounded same-origin transport uses one reviewed command and does not forward arbitrary identity',async()=>{
 let captured;await supplierQuoteCall({...scope,command},async(url,init)=>{captured={url,init};return response(result());});assert.equal(captured.url,'/api/admin/supplier-requests/'+id+'/quotation?tenant=qa-only');assert.equal(captured.init.method,'POST');assert.equal(captured.init.credentials,'same-origin');assert.equal(captured.init.cache,'no-store');assert.equal(captured.init.headers['Idempotency-Key'],key);assert.deepEqual(JSON.parse(captured.init.body),command.body);
 let reads=0;await supplierQuoteCall(scope,async(url,init)=>{reads++;assert.equal(init.method,'GET');assert.equal(init.body,undefined);return response(envelope());});assert.equal(reads,1);
});
test('invalid scope, cursor or locally forged command never reaches a provider',async()=>{
 for(const patch of [{id:'bad'},{tenantId:'bad'},{tenant:'../bad'},{before:0},{before:1},{command:{...command,key:'bad'}},{command:{...command,body:{...command.body,actor_id:actor}}},{command:{...command,body:{...command.body,offer:{...offer,net_minor:1.1}}}}]){let calls=0;await assert.rejects(supplierQuoteCall({...scope,command,...patch},async()=>{calls++;throw Error();}));assert.equal(calls,0);}
});
for(const status of [400,401,403,404,409,429])test('explicit rejection remains a non-committed result '+status,async()=>assert.rejects(call({ok:false,reason:'supplier_quote_scope_forbidden'},command,status),e=>e.status===status&&!e.uncertain));
for(const status of [408,500,503])test('unconfirmed quote write remains uncertain '+status,async()=>assert.rejects(call({ok:false,reason:'unavailable'},command,status),e=>e.uncertain));
test('wrong provenance, malformed JSON and untrusted receipt stay uncertain after a mutation, not after read',async()=>{
 for(const headers of [{'x-nexid-data-mode':'demo'},{'x-nexid-data-mode':''},{'content-type':'text/html'}])await assert.rejects(call(result(),command,200,headers),e=>e.uncertain);
 await assert.rejects(call(result({receipt:null})),e=>e.uncertain);await assert.rejects(call(envelope({writes_enabled:null}),null),e=>!e.uncertain);
 for(const data of ['{bad',new Uint8Array([0xff,0xfe])])await assert.rejects(supplierQuoteCall({...scope,command},async()=>new Response(data,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.uncertain);
});
test('response body is limited to one MiB and oversized stream consumption is cancelled',async()=>{
 let cancelled=false,reads=0;const stream=new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(600000));},cancel(){cancelled=true;}});await assert.rejects(supplierQuoteCall({...scope,command},async()=>new Response(stream,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.uncertain);assert.equal(cancelled,true);assert.ok(reads<=4);
});
test('caller abort terminates exactly one attempted quote write and never retries automatically',async()=>{
 const controller=new AbortController();let calls=0,signal;const waiting=supplierQuoteCall({...scope,command,signal:controller.signal},async(url,init)=>{calls++;signal=init.signal;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))));});controller.abort();await assert.rejects(waiting,e=>e.uncertain);assert.equal(calls,1);assert.equal(signal.aborted,true);
});
