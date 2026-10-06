import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {dashboardPermissionDenied,dashboardPermissionMatches} from '../src/lib/permission-policy.ts';
import {resolveDashboardTenantScope} from '../src/lib/dashboard-tenant-scope-policy.ts';

// Execute the actual HTTP forwarder. Every credential and transport boundary is synthetic.
const source=await readFile(new URL('../src/app/api/tenant-marketplace/route-helpers.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports','productUrls','dashboardFetch','dashboardPermissionDenied','dashboardPermissionMatches','resolveDashboardTenantScope','getDashboardSessionCredential',compiled)(exports,{api:'http://synthetic-api.invalid'},()=>{throw Error('unexpected default transport');},dashboardPermissionDenied,dashboardPermissionMatches,resolveDashboardTenantScope,()=>{throw Error('unexpected default credential');});
const run=exports.forwardTenantMarketplace;
const base={role:'tenant-admin',tenantSlug:'qa-tenant',permissions:['marketplace:read','marketplace:write'],deniedPermissions:[],isDemo:false};
function req(method='GET',query='',body='{}',headers={}){return new Request('http://synthetic-dashboard.invalid/api/tenant-marketplace'+query,{method,headers:{origin:'http://synthetic-dashboard.invalid','content-type':'application/json',...headers},...(method==='GET'?{}:{body})});}
function deps(session=base,reply=()=>new Response('{"ok":true}',{status:200})){const calls=[];return{calls,apiBase:'http://synthetic-api.invalid',credential:async()=>session?{session,bearerToken:'synthetic-only-token'}:null,fetcher:async(url,init)=>{calls.push({url,init});return reply();}};}

test('real GET and POST forward only canonical tenant and a validated bearer, with no caller actor headers',async()=>{
 for(const method of['GET','POST']){const d=deps();const command=JSON.stringify({kind:'product',action:'save_draft'});const response=await run(req(method,'',command,{authorization:'Bearer attacker','x-tenant':'foreign','x-admin-scope':'super_admin',cookie:'caller-cookie'}),d);
 assert.equal(response.status,200);assert.equal(d.calls.length,1);assert.equal(d.calls[0].url,'http://synthetic-api.invalid/admin/consumer-network/catalog?tenant=qa-tenant');assert.equal(d.calls[0].init.cache,'no-store');assert.equal(d.calls[0].init.headers.authorization,'Bearer synthetic-only-token');for(const key of['cookie','x-tenant','x-admin-scope'])assert.equal(d.calls[0].init.headers[key],undefined);assert.equal(d.calls[0].init.body,method==='POST'?command:undefined);assert.match(response.headers.get('cache-control'),/private, no-store/);}
});
test('foreign, duplicate and unrecognized query scope never reaches the API',async()=>{for(const query of['?tenant=foreign','?tenant=qa-tenant&tenant=qa-tenant','?tenant=qa-tenant&sandbox=1']){const d=deps();assert.ok([400,403].includes((await run(req('GET',query),d)).status));assert.equal(d.calls.length,0);}});
test('exact-product readback passes only one canonical UUID; mutations cannot smuggle IDs through query',async()=>{
 const id='10000000-0000-4000-8000-000000000001',d=deps();assert.equal((await run(req('GET','?id='+id),d)).status,200);assert.equal(d.calls[0].url,'http://synthetic-api.invalid/admin/consumer-network/catalog?tenant=qa-tenant&id='+id);
 for(const [method,query]of[['GET','?id=semantic-old-slug'],['GET','?id='+id+'&id='+id],['POST','?id='+id]]){const blocked=deps();assert.equal((await run(req(method,query),blocked)).status,400);assert.equal(blocked.calls.length,0);}
});
test('read and write preserve capability roles and explicit denies, even with wildcard grants',async()=>{
 for(const session of[{...base,permissions:[]},{...base,permissions:['*'],deniedPermissions:['marketplace:read']},{...base,role:'viewer',permissions:['*']},{...base,role:'supplier-operator',permissions:['*']}]){const d=deps(session);assert.equal((await run(req(),d)).status,403);assert.equal(d.calls.length,0);}
 const marketing=deps({...base,role:'marketing-manager'});assert.equal((await run(req(),marketing)).status,200);assert.equal((await run(req('POST'),marketing)).status,403);assert.equal(marketing.calls.length,1);
 for(const session of[{...base,deniedPermissions:['marketplace:write']},{...base,role:'super-admin',deniedPermissions:['marketplace:write']}]){const d=deps(session);assert.equal((await run(req('POST','?tenant=qa-tenant'),d)).status,403);assert.equal(d.calls.length,0);}
});
test('superadmin must select an explicit company; session-free and demo requests cannot touch the API',async()=>{
 const superadmin=deps({...base,role:'super-admin',tenantSlug:null,permissions:[]});assert.equal((await run(req(),superadmin)).status,400);assert.equal(superadmin.calls.length,0);assert.equal((await run(req('GET','?tenant=other-qa'),superadmin)).status,200);assert.match(superadmin.calls[0].url,/tenant=other-qa$/);
 for(const session of[null,{...base,isDemo:true}]){const d=deps(session);assert.equal((await run(req(),d)).status,session?403:401);assert.equal(d.calls.length,0);}
});
test('writes require same origin, JSON and a bounded object before forwarding',async()=>{
 for(const [request,status]of[[req('POST','','{}',{origin:'https://foreign.invalid'}),403],[req('POST','','{}',{'sec-fetch-site':'cross-site'}),403],[req('POST','','{}',{'content-type':'text/plain'}),415],[req('POST','','not-json'),400],[req('POST','','[]'),400],[req('POST','',JSON.stringify({text:'x'.repeat(25*1024)})),413]]){const d=deps();assert.equal((await run(request,d)).status,status);assert.equal(d.calls.length,0);}
});
test('API authorization, conflict and unavailable results are preserved without cookies or provider headers',async()=>{
 for(const status of[401,403,409,503]){const d=deps(base,()=>new Response('{"ok":false,"reason":"catalog_revision_conflict"}',{status,headers:{'set-cookie':'private=secret','x-provider-secret':'secret','retry-after':'5'}}));const response=await run(req(),d);assert.equal(response.status,status);assert.equal((await response.json()).ok,false);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('x-provider-secret'),null);assert.equal(response.headers.get('retry-after'),'5');}
});
test('credential and transport failures stay unavailable; unsupported item mutations are never forwarded',async()=>{
 const d=deps();d.fetcher=async()=>{throw Error('synthetic disconnected');};const response=await run(req('POST'),d);assert.equal(response.status,503);assert.equal((await response.json()).reason,'catalog_unavailable');
 for(const method of['PATCH','DELETE','PUT']){const inactive=deps();assert.equal((await run(req(method),inactive)).status,405);assert.equal(inactive.calls.length,0);}
});
