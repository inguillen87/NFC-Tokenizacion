import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { dashboardHighImpactPermissionMatches, dashboardPermissionMatches, dashboardPermissionDenied } from '../src/lib/permission-policy.ts';
import { supplierOperatorCan } from '../src/lib/supplier-operator-access.ts';

// Execute the actual HTTP forwarder with its three injectable boundaries. No
// Next server, remote credential resolver or provider is contacted by this test.
const source=await readFile(new URL('../src/lib/supplier-request-proxy.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports','dashboardHighImpactPermissionMatches','dashboardPermissionMatches','dashboardPermissionDenied','supplierOperatorCan','getDashboardSessionCredential','dashboardFetch','productUrls',compiled)(exports,dashboardHighImpactPermissionMatches,dashboardPermissionMatches,dashboardPermissionDenied,supplierOperatorCan,()=>{throw Error('Unexpected real resolver');},()=>{throw Error('Unexpected real transport');},{api:'http://unexpected.invalid'});
const {forwardSupplierRequest}=exports;
const id='40000000-0000-4000-8000-000000000001',key='50000000-0000-4000-8000-000000000001';
const session=(patch={})=>({id:'20000000-0000-4000-8000-000000000001',role:'operations-manager',tenantSlug:'qa-only',permissions:['supplier_order.create'],deniedPermissions:[],isDemo:false,...patch});
const payload={title:'Solicitud sintética',construction_id:'',quantity:null,pack_purpose:null,notes:''};
function req(method='GET',query='',headers={},body=payload){return new Request('http://localhost/api/admin/supplier-requests'+query,{method,headers:{cookie:'DO_NOT_FORWARD',authorization:'Bearer DO_NOT_FORWARD','x-admin-tenant':'foreign',origin:'http://localhost','sec-fetch-site':'same-origin','content-type':'application/json','idempotency-key':key,...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});}
function deps(patch={},options={}){const calls=[];let credentials=0;return {calls,get credentials(){return credentials;},value:{credential:async()=>{credentials++;if(options.throwCredential)throw Error('PRIVATE_RESOLVER');return options.missing?null:{session:session(patch),bearerToken:'SYNTHETIC_ROTATED_BEARER',rotatedSessionToken:'DO_NOT_FORWARD'};},fetcher:async(url,init)=>{calls.push({url,init});if(options.throwFetch)throw Error('PRIVATE_UPSTREAM');return Response.json(options.body||{ok:true},{status:options.status||200,headers:{'retry-after':'5','set-cookie':'DO_NOT_FORWARD','x-provider-secret':'DO_NOT_FORWARD'}});},apiBase:'http://synthetic-api.invalid'}};}
async function run(request,segments=[],dependency=deps()){const response=await forwardSupplierRequest(request,segments,dependency.value);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-nexid-data-mode'),'production');return {status:response.status,body:await response.json(),headers:response.headers,dependency};}

test('BFF enforces actual high-impact roles, explicit denies, real session and tenant before transport',async()=>{
  for(const patch of [{role:'viewer'},{role:'security-operator'},{role:'api-integration'},{permissions:[]},{deniedPermissions:['supplier_order.create']},{deniedPermissions:['supplier_orders:write']},{isDemo:true},{tenantSlug:null}]){const d=deps(patch);assert.equal((await run(req(),[],d)).status,403);assert.equal(d.calls.length,0);}
  for(const [options,status] of [[{missing:true},401],[{throwCredential:true},503]]){const d=deps({},options);const result=await run(req(),[],d);assert.equal(result.status,status);assert.equal(d.calls.length,0);assert.doesNotMatch(JSON.stringify(result.body),/PRIVATE/);}
  const d=deps();assert.equal((await run(req('GET','?tenant=foreign'),[],d)).status,403);assert.equal(d.calls.length,0);
});

test('path, duplicate query, origin and idempotency gates reject before authentication or provider',async()=>{
  const cases=[[req('DELETE'),[]],[req('GET'),['bad']],[req('PATCH'),[id,'submit']],[req('POST'),[id,'unsafe']],[req('GET','?tenant=qa-only&tenant=qa-only'),[]],[req('GET','?limit=5'),[]],[req('POST','',{origin:'http://foreign.invalid'}),[]],[req('POST','',{'sec-fetch-site':'cross-site'}),[]],[req('POST','',{'idempotency-key':'bad'}),[]],[req('POST','',{'content-type':'text/plain'}),[]]];
  for(const [request,segments]of cases){const d=deps();assert.ok([400,403,405].includes((await run(request,segments,d)).status));assert.equal(d.calls.length,0);assert.equal(d.credentials,0);}
});

test('only rotated server credential, canonical tenant, reviewed body and operation key reach API',async()=>{
  for(const [method,segments]of [['GET',[]],['POST',[]],['GET',[id]],['PATCH',[id]],['POST',[id,'submit']]]){
    const d=deps();const result=await run(req(method),segments,d);assert.equal(result.status,200);assert.equal(d.calls.length,1);
    const {url,init}=d.calls[0];assert.equal(url,`http://synthetic-api.invalid/admin/supplier-requests${segments.length?'/'+segments.join('/'):''}?tenant=qa-only`);assert.equal(init.method,method);assert.equal(init.cache,'no-store');assert.equal(init.headers.authorization,'Bearer SYNTHETIC_ROTATED_BEARER');assert.doesNotMatch(JSON.stringify(init.headers),/DO_NOT_FORWARD|x-admin-tenant|cookie/i);
    if(method!=='GET'){assert.equal(init.headers['Idempotency-Key'],key);assert.deepEqual(JSON.parse(init.body),payload);}assert.equal(result.headers.get('set-cookie'),null);assert.equal(result.headers.get('x-provider-secret'),null);assert.equal(result.headers.get('retry-after'),'5');
  }
});

test('superadmin global inbox stays read-only until an explicit selected company is bound',async()=>{
  const sa={role:'super-admin',tenantSlug:null,permissions:['supplier_order.create']};const global=deps(sa);assert.equal((await run(req(),[],global)).status,200);assert.equal(global.calls[0].url,'http://synthetic-api.invalid/admin/supplier-requests');
  for(const [method,segments]of [['POST',[]],['GET',[id]],['PATCH',[id]],['POST',[id,'submit']]]){const d=deps(sa);assert.equal((await run(req(method),segments,d)).status,400);assert.equal(d.calls.length,0);}
  for(const tenant of ['marca.ar','a'.repeat(128)]){const d=deps(sa);assert.equal((await run(req('GET','?tenant='+tenant),[],d)).status,200);assert.ok(d.calls[0].url.endsWith('?tenant='+tenant));}
});

test('oversized or malformed bodies fail closed and backend failures remain explicit',async()=>{
  for(const body of ['{bad','[]','null',JSON.stringify({notes:'x'.repeat(33000)})]){const d=deps();assert.ok([400,413].includes((await run(req('POST','',{},body),[],d)).status));assert.equal(d.calls.length,0);}
  for(const status of [400,401,403,409,503]){const d=deps({}, {status,body:{ok:false,reason:'synthetic_rejection'}});const result=await run(req('POST'),[],d);assert.equal(result.status,status);assert.equal(result.body.ok,false);}
  const result=await run(req('POST'),[],deps({}, {throwFetch:true}));assert.equal(result.status,503);assert.doesNotMatch(JSON.stringify(result.body),/PRIVATE/);
});

test('review routes keep private tenant scope and only allow each party to perform its own action',async()=>{
  for(const [role,action] of [['operations-manager','respond'],['super-admin','request_information']]){
    const d=deps({role});const body={action,message:'Aclaración sintética',expected_revision:1,expected_request_revision:3};const result=await run(req('POST','?tenant=qa-only',{},body),[id,'review'],d);assert.equal(result.status,200);assert.equal(d.calls.length,1);assert.ok(d.calls[0].url.endsWith(`/${id}/review?tenant=qa-only`));assert.deepEqual(JSON.parse(d.calls[0].init.body),body);assert.equal(d.calls[0].init.headers['Idempotency-Key'],key);
    const wrong=deps({role});assert.equal((await run(req('POST','?tenant=qa-only',{},{...body,action:action==='respond'?'request_information':'respond'}),[id,'review'],wrong)).status,403);assert.equal(wrong.calls.length,0);
  }
  for(const patch of [{isDemo:true},{permissions:[]},{deniedPermissions:['supplier_order.create']},{tenantSlug:'foreign'}]){const d=deps(patch);assert.equal((await run(req('GET','?tenant=qa-only'),[id,'review'],d)).status,403);assert.equal(d.calls.length,0);}
});

test('review history cursor is bounded, exclusive query authority and GET only',async()=>{
  const d=deps();assert.equal((await run(req('GET','?tenant=qa-only&before_revision=13'),[id,'review'],d)).status,200);assert.ok(d.calls[0].url.endsWith('/review?tenant=qa-only&before_revision=13'));assert.equal(d.calls[0].init.method,'GET');
  for(const [method,query,segments] of [['GET','?before_revision=0',[id,'review']],['GET','?before_revision=abc',[id,'review']],['GET','?before_revision=2&before_revision=2',[id,'review']],['POST','?before_revision=2',[id,'review']],['GET','?before_revision=2',[id]],['PATCH','',[id,'review']],['DELETE','',[id,'review']],['GET','',[id,'reviews']]]){const d=deps();assert.ok([400,405].includes((await run(req(method,query),segments,d)).status));assert.equal(d.calls.length,0);}
});

const operator=()=>({role:'supplier-operator',userId:'20000000-0000-4000-8000-000000000001',tenantId:null,tenantSlug:null,permissions:['supplier_request.assigned.read','supplier_request.assigned.review','*']});
test('assigned namespace admits only the current limited operator without a tenant selector',async()=>{
  for(const segments of [['assigned'],['assigned',id],['assigned',id,'review']]){const d=deps(operator());assert.equal((await run(req('GET'),segments,d)).status,200);assert.equal(d.calls[0].url,`http://synthetic-api.invalid/admin/supplier-requests/${segments.join('/')}`);}
  const d=deps(operator());assert.equal((await run(req('POST','',{},{action:'request_information',message:'Question',expected_revision:0,expected_request_revision:2}),['assigned',id,'review'],d)).status,200);assert.equal(d.calls[0].init.headers['Idempotency-Key'],key);
  for(const patch of [{userId:undefined},{tenantSlug:'qa-only'},{tenantId:id},{role:'super-admin'},{isDemo:true},{permissions:['*']},{deniedPermissions:['supplier_request.assigned.read']}]){const d=deps({...operator(),...patch});assert.equal((await run(req(),['assigned'],d)).status,403);assert.equal(d.calls.length,0);}
  for(const segments of [[],[id],[id,'review'],[id,'assignment'],['operators']]){const d=deps(operator());assert.equal((await run(req('GET','?tenant=qa-only'),segments,d)).status===200,false);assert.equal(d.calls.length,0);}
  for(const query of ['?tenant=qa-only','?tenant=','?operator_id='+operator().userId]){const d=deps(operator());assert.equal((await run(req('GET',query),['assigned'],d)).status,400);assert.equal(d.calls.length,0);}
  for(const [method,segments]of [['POST',['assigned']],['PATCH',['assigned',id]],['POST',['assigned',id,'submit']],['GET',['assigned',id,'assignment']]]){const d=deps(operator());assert.equal((await run(req(method),segments,d)).status,405);assert.equal(d.calls.length,0);}
});
test('assignment administration requires SA and its independent assign capability, never inherited tenant create authority',async()=>{
  for(const patch of [{role:'super-admin',permissions:['supplier_order.create']},{role:'operations-manager',permissions:['*']},{role:'super-admin',permissions:['*'],deniedPermissions:['supplier_requests:assign']},{role:'super-admin',permissions:['*'],deniedPermissions:['supplier_request.assign']}]){const d=deps(patch);assert.equal((await run(req('GET','?tenant=qa-only'),[id,'assignment'],d)).status,403);assert.equal(d.calls.length,0);}
  for(const permission of ['supplier_request.assign','supplier_requests:assign','*']){const d=deps({role:'super-admin',tenantSlug:null,permissions:[permission]});assert.equal((await run(req('GET'),['operators'],d)).status,200);assert.equal(d.calls[0].url,'http://synthetic-api.invalid/admin/supplier-requests/operators');}
  const d=deps({role:'super-admin',permissions:['supplier_request.assign']});const body={operator_id:operator().userId,expected_revision:0,expected_request_revision:2};assert.equal((await run(req('POST','?tenant=qa-only',{},body),[id,'assignment'],d)).status,200);assert.deepEqual(JSON.parse(d.calls[0].init.body),body);
});
test('operator review never becomes a company response and separate denied review permission blocks writes',async()=>{
  for(const patch of [{permissions:['supplier_request.assigned.read']},{deniedPermissions:['supplier_request.assigned.review']}]){const d=deps({...operator(),...patch});assert.equal((await run(req('POST','',{},{action:'request_information'}),['assigned',id,'review'],d)).status,403);assert.equal(d.calls.length,0);}
  const d=deps(operator());assert.equal((await run(req('POST','',{},{action:'respond'}),['assigned',id,'review'],d)).status,403);assert.equal(d.calls.length,0);
});

test('cancellation BFF exposes only GET/POST with authenticated tenant and same-origin command',async()=>{
 const body={expected_revision:2,expected_review_revision:0,reason:'Proyecto suspendido.'};
 for(const method of ['GET','POST']){const d=deps();assert.equal((await run(req(method,'',{},body),[id,'cancellation'],d)).status,200);assert.equal(d.calls[0].url,'http://synthetic-api.invalid/admin/supplier-requests/'+id+'/cancellation?tenant=qa-only');if(method==='POST')assert.deepEqual(JSON.parse(d.calls[0].init.body),body);}
 for(const [request,segments]of [[req('DELETE'),[id,'cancellation']],[req('PATCH'),[id,'cancellation']],[req('GET','?before_revision=1'),[id,'cancellation']],[req('POST','',{origin:'http://foreign.invalid'}),[id,'cancellation']],[req('POST'),['assigned',id,'cancellation']]]){const d=deps();assert.ok([400,403,405].includes((await run(request,segments,d)).status));assert.equal(d.calls.length,0);}
 for(const patch of [{...operator()},{role:'viewer'},{isDemo:true},{deniedPermissions:['supplier_order.create']}]){const d=deps(patch);assert.equal((await run(req('POST'),[id,'cancellation'],d)).status,403);assert.equal(d.calls.length,0);}
});

test('quotation BFF isolates issuer and buyer actions and accepts history cursor only for reads',async()=>{
 for(const [role,action]of [['super-admin','issue'],['super-admin','withdraw'],['operations-manager','accept'],['operations-manager','reject']]){
  const d=deps({role}),body={action,expected_revision:0,expected_request_revision:2,expected_review_revision:0,offer:null,reason:'QA'};const result=await run(req('POST','?tenant=qa-only',{},body),[id,'quotation'],d);assert.equal(result.status,200);assert.equal(d.calls[0].url,'http://synthetic-api.invalid/admin/supplier-requests/'+id+'/quotation?tenant=qa-only');assert.deepEqual(JSON.parse(d.calls[0].init.body),body);
 }
 for(const [role,action]of [['super-admin','accept'],['super-admin','reject'],['operations-manager','issue'],['operations-manager','withdraw']]){const d=deps({role});assert.equal((await run(req('POST','?tenant=qa-only',{},{action}),[id,'quotation'],d)).status,403);assert.equal(d.calls.length,0);}
 const history=deps();assert.equal((await run(req('GET','?before_revision=3'),[id,'quotation'],history)).status,200);assert.ok(history.calls[0].url.endsWith('/quotation?tenant=qa-only&before_revision=3'));
 for(const [request,segments]of [[req('POST','?before_revision=3'),[id,'quotation']],[req('PATCH'),[id,'quotation']],[req('GET'),['assigned',id,'quotation']],[req('POST','',{origin:'http://foreign.invalid'},{action:'accept'}),[id,'quotation']]]){const d=deps();assert.ok([400,403,405].includes((await run(request,segments,d)).status));assert.equal(d.calls.length,0);}
 for(const patch of [{...operator()},{role:'viewer'},{isDemo:true},{deniedPermissions:['supplier_order.create']}]){const d=deps(patch);assert.equal((await run(req('GET'),[id,'quotation'],d)).status,403);assert.equal(d.calls.length,0);}
});

test('supplier binding BFF keeps company read-only and supervisor writes scoped without forwarding client identity',async()=>{
 const body={action:'assign',expected_revision:0,expected_request_revision:5,order_id:key,supplier:{reference:'FACTORY-QA',name:'QA',confirmation_ref:'DOC-QA'},spec:{revision:1,hash:'sha256:'+'a'.repeat(64),decision_id:key},reason:'Registration.'};
 const company=deps();assert.equal((await run(req('GET'),[id,'supplier-binding'],company)).status,200);assert.equal(company.calls.length,1);
 const denied=deps();assert.equal((await run(req('POST','',{},body),[id,'supplier-binding'],denied)).status,403);assert.equal(denied.calls.length,0);
 const admin=deps({role:'super-admin'});assert.equal((await run(req('POST','?tenant=qa-only',{},body),[id,'supplier-binding'],admin)).status,200);assert.equal(admin.calls[0].url,'http://synthetic-api.invalid/admin/supplier-requests/'+id+'/supplier-binding?tenant=qa-only');assert.deepEqual(JSON.parse(admin.calls[0].init.body),body);assert.equal(admin.calls[0].init.headers['Idempotency-Key'],key);assert.doesNotMatch(JSON.stringify(admin.calls[0].init.headers),/DO_NOT_FORWARD/);
 for(const [request,segments]of [[req('POST','?tenant=qa-only',{origin:'http://foreign.invalid'}),[id,'supplier-binding']],[req('PATCH'),[id,'supplier-binding']],[req('DELETE'),[id,'supplier-binding']],[req('GET','?before_revision=0'),[id,'supplier-binding']],[req('POST'),['assigned',id,'supplier-binding']]]){const d=deps({role:'super-admin'});assert.ok([400,403,405].includes((await run(request,segments,d)).status));assert.equal(d.calls.length,0);}
 for(const patch of [{...operator()},{role:'viewer'},{role:'super-admin',isDemo:true},{role:'super-admin',deniedPermissions:['supplier_order.create']}]){const d=deps(patch);assert.equal((await run(req('GET','?tenant=qa-only'),[id,'supplier-binding'],d)).status,403);assert.equal(d.calls.length,0);}
 const page=deps();assert.equal((await run(req('GET','?before_revision=13'),[id,'supplier-binding'],page)).status,200);assert.ok(page.calls[0].url.endsWith('before_revision=13'));
});

test('delivery acuses are source-bound, GET/POST only, read-only for companies and unavailable to limited operators',async()=>{
 const admin={role:'super-admin',tenantSlug:null,permissions:['supplier_order.create']};
 for(const method of ['GET','POST']){const d=deps(admin);assert.equal((await run(req(method,'?tenant=qa-only'),[id,'delivery-ack'],d)).status,200);assert.ok(d.calls[0].url.endsWith('/delivery-ack?tenant=qa-only'));}
 const company=deps();assert.equal((await run(req('GET'),[id,'delivery-ack'],company)).status,200);const writer=deps();const denied=await run(req('POST'),[id,'delivery-ack'],writer);assert.equal(denied.status,403);assert.equal(denied.body.reason,'supplier_delivery_ack_scope_forbidden');assert.equal(writer.calls.length,0);
 for(const [method,segments]of [['PATCH',[id,'delivery-ack']],['DELETE',[id,'delivery-ack']],['POST',['assigned',id,'delivery-ack']]]){const d=deps(admin);assert.equal((await run(req(method,'?tenant=qa-only'),segments,d)).status,405);assert.equal(d.calls.length,0);}
 for(const patch of [operator(),{...admin,isDemo:true},{...admin,deniedPermissions:['supplier_order.create']}]){const d=deps(patch);assert.equal((await run(req('GET','?tenant=qa-only'),[id,'delivery-ack'],d)).status,403);assert.equal(d.calls.length,0);}
 const d=deps(admin);assert.equal((await run(req('GET','?tenant=qa-only&before_revision=4'),[id,'delivery-ack'],d)).status,200);assert.ok(d.calls[0].url.endsWith('before_revision=4'));
});

test('service status BFF keeps tenant authority and can forward no mutation or custom selector',async()=>{
 const d=deps();assert.equal((await run(req('GET'),['service-status'],d)).status,200);assert.ok(d.calls[0].url.endsWith('/service-status?tenant=qa-only'));assert.equal(d.calls[0].init.method,'GET');assert.doesNotMatch(JSON.stringify(d.calls[0].init),/DO_NOT_FORWARD|foreign/);
 for(const query of ['?tenant=foreign','?tenant=qa-only&url=other','?tenant=qa-only&before_revision=1']){const dep=deps();assert.ok([400,403].includes((await run(req('GET',query),['service-status'],dep)).status));assert.equal(dep.calls.length,0);}
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD']){const dep=deps();assert.equal((await run(method==='HEAD'?new Request('http://localhost/api/admin/supplier-requests/service-status',{method:'HEAD'}):req(method),['service-status'],dep)).status,405);assert.equal(dep.calls.length,0);}
 for(const patch of [operator(),{isDemo:true},{permissions:[]},{deniedPermissions:['supplier_order.create']}]){const dep=deps(patch);assert.equal((await run(req('GET'),['service-status'],dep)).status,403);assert.equal(dep.calls.length,0);}
 const global=deps({role:'super-admin',tenantSlug:null});assert.equal((await run(req('GET'),['service-status'],global)).status,400);assert.equal(global.calls.length,0);
});
