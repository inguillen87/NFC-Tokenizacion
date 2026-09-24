import assert from 'node:assert/strict';
import test from 'node:test';
import { checkAdminWithPermission } from '../src/lib/auth.ts';
import { makeSupplierRequestCancellationHandlers } from '../src/lib/supplier-request-cancellation-http.ts';
import { parseSupplierRequestCancellation } from '../src/lib/supplier-request-cancellation-contract.ts';
import { supplierRequestFromRow } from '../src/lib/supplier-request-contract.ts';
const tenant='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',actor='20000000-0000-4000-8000-000000000001',sid='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001';
const command={expected_revision:2,expected_review_revision:0,reason:'Cambio del proyecto.'};
const row=(patch={})=>({id,tenant_id:tenant,tenant_slug:'qa-a',title:'Proyecto QA',construction_id:'tt_bridge',quantity:125,pack_purpose:'trial_integration',notes:'Datos originales',status:'cancelled',revision:3,created_by:actor,updated_by:actor,submitted_by:actor,created_at:'2026-09-23T12:00:00.000Z',submitted_at:'2026-09-23T12:01:00.000Z',updated_at:'2026-09-24T12:00:00.000Z',order_id:null,review_summary:{state:'pending',revision:0,updated_at:null},cancellation_reason:command.reason,cancelled_by:actor,cancelled_at:'2026-09-24T12:00:00.000Z',...patch});
function session(patch={}){return{id:sid,userId:actor,email:'qa@example.invalid',label:'QA',role:'operations-manager',tenantId:tenant,tenantSlug:'qa-a',permissions:['supplier_order.create'],deniedPermissions:[],mfaVerified:false,expiresAt:new Date(Date.now()+60000).toISOString(),rotatedCookieValue:null,setupCompleted:true,...patch};}
function fixture(options={}){
 const queries=[],permissions=[];const result=options.result||{ok:true,request:row(),receipt:{idempotency_key:key,action:'cancel',revision:3},idempotent_replay:false};
 const handlers=makeSupplierRequestCancellationHandlers({enabled:()=>options.enabled!==false,authorize:(req,p)=>{permissions.push(p);return checkAdminWithPermission(req,p,options.resolver|| (async()=>session(options.session)));},query:async(strings,...values)=>{
  const sql=strings.join('?');queries.push({sql,values});if(sql.includes('FROM public.tenants'))return[{id:tenant,slug:'qa-a'}];if(sql.includes('to_regprocedure'))return[{available:options.available!==false}];
  if(sql.includes('nexid_cancel_supplier_request_v1')){if(options.fail)throw Error('PRIVATE_SQL_CREDENTIAL');return[{result}];}return options.rows||[row()];
 }});return{queries,permissions,handlers};
}
async function call(f,method='post',body=command,query='?tenant=qa-a',headers={}){
 const req=new Request('http://localhost/admin/supplier-requests/'+id+'/cancellation'+query,{method:method==='get'?'GET':'POST',headers:{authorization:'Bearer synthetic-local-session',...(method==='post'?{'content-type':'application/json','idempotency-key':key}:{}),...headers},...(method==='post'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
 const response=await f.handlers[method](req,id);assert.match(response.headers.get('cache-control'),/private.*no-store/);return{status:response.status,body:await response.json()};
}
test('cancellation input is closed, bounded and does not accept actor/tenant or order overrides',()=>{
 assert.deepEqual(parseSupplierRequestCancellation({...command,reason:'  Cambio del proyecto.  '}),command);
 for(const patch of [{reason:''},{reason:' '},{reason:'x'.repeat(2001)},{reason:'bad\u0001text'},{reason:'api_key=synthetic-private-value'},{expected_revision:0},{expected_revision:'2'},{expected_revision:2147483647},{expected_review_revision:-1},{expected_review_revision:1.5},{expected_review_revision:2147483647},{tenant_id:other},{actor_id:actor},{order_id:id}])assert.throws(()=>parseSupplierRequestCancellation({...command,...patch}));
 for(const value of [null,[],{},'text'])assert.throws(()=>parseSupplierRequestCancellation(value));
});
test('cancellation snapshot requires a deployed executable capability and performs no business writes',async()=>{
 const f=fixture();assert.equal((await call(f,'get')).status,200);assert.equal(f.queries.length,3);assert.ok(!f.queries.some(q=>q.sql.includes('SELECT public.nexid_cancel')));
 const missing=fixture({available:false});const result=await call(missing,'get');assert.equal(result.status,503);assert.equal(missing.queries.length,2);
});
test('a committed cancellation binds actor/session from real auth and validates the exact receipt',async()=>{
 const f=fixture(),result=await call(f);assert.equal(result.status,200);assert.equal(result.body.request.status,'cancelled');assert.deepEqual(f.permissions,['supplier_order.create']);
 const write=f.queries.find(q=>q.sql.includes('SELECT public.nexid_cancel'));assert.deepEqual(JSON.parse(write.values[0]),{...command,tenant_id:tenant,request_id:id,actor_id:actor,auth_session_id:sid,idempotency_key:key});
 assert.doesNotMatch(JSON.stringify(result),/auth_session_id|fingerprint|PRIVATE_SQL/);
});
for(const patch of [{role:'supplier-operator',tenantId:null,tenantSlug:null,permissions:['*']},{role:'viewer'},{role:'api-integration'},{permissions:[]},{deniedPermissions:['supplier_order.create']},{deniedPermissions:['supplier_orders:write']}])test('cancellation respects role/deny before touching SQL '+JSON.stringify(patch),async()=>{
 for(const method of ['get','post']){const f=fixture({session:patch});assert.ok([401,403].includes((await call(f,method)).status));assert.equal(f.queries.length,0);}
});
test('missing sessions and session lookup failure stay bounded and cannot perform SQL',async()=>{
 for(const resolver of [async()=>null,async()=>{throw Error('PRIVATE_SESSION');}]){const f=fixture({resolver}),r=await call(f);assert.ok([401,503].includes(r.status));assert.equal(f.queries.length,0);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);}
});
test('foreign tenant, duplicate query and unbound scope cannot change or read cancellation',async()=>{
 for(const query of ['?tenant=qa-b','?tenant=qa-a&tenant=qa-a','?tenant=qa-a&before_revision=1','?tenant=qa-a&x=true']){const f=fixture();assert.ok([400,403].includes((await call(f,'post',command,query)).status));assert.equal(f.queries.length,0);}
});
test('unavailable migration, huge bodies, wrong MIME and invalid operation keys fail before mutation',async()=>{
 assert.equal((await call(fixture({available:false}))).status,503);
 for(const [body,headers,expected]of [['x'.repeat(17000),{},413],[command,{'content-type':'text/plain'},415],[command,{'idempotency-key':'invalid'},400],['{broken',{},400]]){const f=fixture();assert.equal((await call(f,'post',body,undefined,headers)).status,expected);assert.ok(!f.queries.some(q=>q.sql.includes('SELECT public.nexid_cancel')));}
});
for(const [reason,status]of [['supplier_request_not_found',404],['supplier_request_scope_forbidden',403],['supplier_request_revision_conflict',409],['supplier_request_review_revision_conflict',409],['supplier_request_idempotency_conflict',409],['supplier_request_cancellation_not_submitted',409]])test('stable cancellation refusal '+reason,async()=>{assert.equal((await call(fixture({result:{ok:false,reason}}))).status,status);});
test('malformed or foreign receipts are not reported as successful cancellation',async()=>{
 const good={ok:true,request:row(),receipt:{idempotency_key:key,action:'cancel',revision:3},idempotent_replay:false};
 for(const patch of [{request:row({tenant_id:other})},{request:row({cancelled_by:other,updated_by:other})},{request:row({cancellation_reason:'different'})},{request:row({revision:4})},{receipt:{...good.receipt,idempotency_key:id}},{receipt:{...good.receipt,action:'submit'}},{receipt:{...good.receipt,revision:2}},{idempotent_replay:undefined},{reason:'PRIVATE',ok:false}])assert.equal((await call(fixture({result:{...good,...patch}}))).status,503);
 const sql=await call(fixture({fail:true}));assert.equal(sql.status,503);assert.doesNotMatch(JSON.stringify(sql),/PRIVATE/);
});
test('cancellation DTO requires consistent actor, dates, reason and preserves the submitted evidence',()=>{
 assert.equal(supplierRequestFromRow(row()).status,'cancelled');
 for(const patch of [{cancellation_reason:null},{cancelled_by:null},{cancelled_at:null},{cancelled_at:'2026-09-23T12:00:00.000Z'},{cancelled_by:other},{order_id:id},{status:'submitted'}])assert.throws(()=>supplierRequestFromRow(row(patch)));
});

test('cancellation is opt-in and does not query a database when its rollout switch is off',async()=>{const f=fixture({enabled:false});for(const method of ['get','post']){const result=await call(f,method);assert.equal(result.status,503);assert.equal(result.body.reason,'supplier_request_cancellation_disabled');}assert.equal(f.queries.length,0);});
