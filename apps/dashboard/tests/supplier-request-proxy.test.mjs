import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { dashboardHighImpactPermissionMatches } from '../src/lib/permission-policy.ts';

// Execute the actual HTTP forwarder with its three injectable boundaries. No
// Next server, remote credential resolver or provider is contacted by this test.
const source=await readFile(new URL('../src/lib/supplier-request-proxy.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports','dashboardHighImpactPermissionMatches','getDashboardSessionCredential','dashboardFetch','productUrls',compiled)(exports,dashboardHighImpactPermissionMatches,()=>{throw Error('Unexpected real resolver');},()=>{throw Error('Unexpected real transport');},{api:'http://unexpected.invalid'});
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
