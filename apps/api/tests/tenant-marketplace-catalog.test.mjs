import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {CatalogError,parseCatalogCommand,parseCatalogQuery,parseProductContent,resolveCatalogTenant} from '../src/lib/tenant-marketplace-catalog.ts';
import {createCatalogHandlers} from '../src/lib/tenant-marketplace-catalog-http.ts';
import {checkAdminWithPermission} from '../src/lib/auth.ts';
import {runTenantMarketplaceCatalogPostgresQa} from './helpers/tenant-marketplace-catalog-postgres-qa.mjs';
const product={title:'',description:null,vertical:'wine',category:null,image_url:null,price_amount:null,price_currency:null,external_checkout_url:null,request_to_buy_enabled:false,age_gate_required:false};
const command={kind:'product',action:'save_draft',id:randomUUID(),expectedUpdatedAt:null,content:product};
const stamp='2026-10-06T12:00:00.123456Z';
const tenantId=randomUUID();
const session=(patch={})=>({id:randomUUID(),userId:randomUUID(),email:'qa@example.invalid',label:'Synthetic QA',role:'tenant-admin',tenantId,tenantSlug:'canonical-qa',permissions:['marketplace:read','marketplace:write'],deniedPermissions:[],mfaVerified:true,expiresAt:'2030-01-01T00:00:00.000Z',rotatedCookieValue:null,...patch});
function authFixture(patch={},resolver){let reads=0;const h=createCatalogHandlers({authorize:(req,permission)=>checkAdminWithPermission(req,permission,resolver||(async()=>session(patch))),query:async strings=>{reads++;return strings.join('').includes('FROM tenants')?[{id:tenantId,slug:'canonical-qa'}]:[]}});return{h,get reads(){return reads}};}
const authRequest=(method='GET',suffix='',headers={})=>new Request('https://api.example.invalid/admin/consumer-network/catalog'+suffix,{method,headers:{authorization:'Bearer synthetic-opaque-session',...(method==='POST'?{'content-type':'application/json'}:{}),...headers},...(method==='POST'?{body:'{}'}:{})});
test('draft requires explicit boolean capabilities and preserves unknown price and explicit zero',()=>{
  assert.equal(parseCatalogCommand(command).content.price_amount,null);
  assert.equal(parseProductContent({...product,price_amount:'0',price_currency:'ARS'}).price_amount,'0.00');
  for(const patch of [{request_to_buy_enabled:undefined},{age_gate_required:null},{price_amount:'-1',price_currency:'ARS'},{price_amount:'1.001',price_currency:'ARS'},{price_amount:'1',price_currency:null},{accepts_rewards:true},{authenticity_program_badge:true}])assert.throws(()=>parseProductContent({...product,...patch}),CatalogError);
});
test('only canonical IDs, full allowlisted fields and exact valid revisions enter writes',()=>{
  for(const patch of [{id:command.id.toUpperCase()},{id:'semantic-product-id'},{operationId:randomUUID()},{tenant:'other'},{expectedUpdatedAt:'2026-02-31T00:00:00.000000Z'},{expectedUpdatedAt:'2026-10-06T12:00:00Z'},{expectedUpdatedAt:undefined},{content:{...product,title:'\0'}}])assert.throws(()=>parseCatalogCommand({...command,...patch}),CatalogError);
  assert.equal(parseCatalogCommand({...command,expectedUpdatedAt:stamp}).expectedUpdatedAt,stamp);
});
test('publish/withdraw never accept content, fabricated statuses or implicit network visibility',()=>{
  const base={kind:'brand',action:'publish',id:randomUUID(),expectedUpdatedAt:stamp};
  assert.throws(()=>parseCatalogCommand(base),CatalogError);
  assert.equal(parseCatalogCommand({...base,visible_in_network:true}).visible_in_network,true);
  for(const patch of [{expectedUpdatedAt:null,visible_in_network:true},{visible_in_network:false},{visible_in_network:true,content:{}},{visible_in_network:true,status:'active'}])assert.throws(()=>parseCatalogCommand({...base,...patch}),CatalogError);
});
test('checkout links reject credentials, private/network-address shortcuts, active schemes and ports',()=>{
  for(const url of ['javascript:alert(1)','http://shop.example.org','https://user:password@shop.example.org','https://shop.example.org:8443','https://127.0.0.1','https://10.0.0.1','https://localhost','https://[::1]','https://shop.example.org/#token'])assert.throws(()=>parseProductContent({...product,external_checkout_url:url}),CatalogError);
  assert.equal(parseProductContent({...product,external_checkout_url:'https://shop.example.org/buy'}).external_checkout_url,'https://shop.example.org/buy');
  assert.throws(()=>parseProductContent({...product,image_url:'/assets/../hidden'}),CatalogError);
});
test('list rejects duplicate, unknown and noncanonical lookup parameters',()=>{
  for(const p of ['tenant=a&tenant=b','limit=200','id=semantic','status=active'])assert.throws(()=>parseCatalogQuery(new URLSearchParams(p)),CatalogError);
  assert.equal(parseCatalogQuery(new URLSearchParams('id='+command.id)).id,command.id);
});
test('permission/session failures happen before tenant or catalog reads and remain no-store',async()=>{
  for(const status of [401,403,503]){let reads=0;const h=createCatalogHandlers({authorize:async()=>Response.json({ok:false},{status}),principal:()=>{throw Error('principal must not be read')},query:async()=>{reads++;return[]}});
    for(const method of ['GET','POST']){const r=await h[method](new Request('https://api.example.invalid/admin/consumer-network/catalog'));assert.equal(r.status,status);assert.match(r.headers.get('cache-control'),/no-store/)}assert.equal(reads,0);
  }
});
test('canonical principal tenant ID and slug are both enforced; global scope is never inferred',async()=>{
  const id=randomUUID(),principal={scope:'tenant_admin',tenantId:id,tenantSlug:'canonical-qa'};let reads=0;
  const query=async()=>{reads++;return[{id,slug:'canonical-qa'}]};
  assert.equal((await resolveCatalogTenant(null,principal,query)).id,id);
  await assert.rejects(resolveCatalogTenant('other-qa',principal,query),e=>e.status===403);assert.equal(reads,1);
  await assert.rejects(resolveCatalogTenant(null,{scope:'super_admin'},query),e=>e.status===400);assert.equal(reads,1);
  await assert.rejects(resolveCatalogTenant(null,{...principal,tenantId:randomUUID()},query),e=>e.status===403);
});
test('write role boundary rejects operators even with a synthetic permissive authorization adapter',async()=>{
  const h=createCatalogHandlers({authorize:async()=>null,principal:()=>({scope:'tenant_operator'}),query:async()=>{throw Error('no queries')}});
  assert.equal((await h.POST(new Request('https://api.example.invalid/admin/consumer-network/catalog'))).status,403);
});
test('actual persisted-session permission guard enforces marketplace role registry, grants and explicit denies',async()=>{
  for(const role of ['tenant-owner','tenant-admin']){
    const permitted=authFixture({role});assert.equal((await permitted.h.GET(authRequest())).status,200);assert.equal((await permitted.h.POST(authRequest('POST'))).status,400);
    for(const patch of [{permissions:[]},{deniedPermissions:['marketplace:read','marketplace:write']}]){const denied=authFixture({role,...patch});for(const method of ['GET','POST'])assert.equal((await denied.h[method](authRequest(method))).status,403);assert.equal(denied.reads,0);}
  }
  const marketing=authFixture({role:'marketing-manager'});assert.equal((await marketing.h.GET(authRequest())).status,200);const before=marketing.reads;assert.equal((await marketing.h.POST(authRequest('POST'))).status,403);assert.equal(marketing.reads,before);
  for(const role of ['operations-manager','packaging-operator','security-analyst','reseller','api-integration','viewer']){const denied=authFixture({role});for(const method of ['GET','POST'])assert.equal((await denied.h[method](authRequest(method))).status,403);assert.equal(denied.reads,0);}
});
test('actual auth denies missing/revoked/unavailable sessions and untrusted scope headers before queries',async()=>{
  for(const [resolver,status] of [[async()=>null,401],[async()=>{throw Error('private resolver failure')},503]]){const f=authFixture({},resolver);for(const method of ['GET','POST'])assert.equal((await f.h[method](authRequest(method))).status,status);assert.equal(f.reads,0);}
  const missing=authFixture();assert.equal((await missing.h.GET(authRequest('GET','',{authorization:''}))).status,401);assert.equal(missing.reads,0);
  const forged=authFixture();assert.equal((await forged.h.GET(authRequest('GET','?tenant=other-qa',{'x-admin-scope':'super_admin','x-tenant-id':randomUUID()}))).status,403);assert.equal(forged.reads,0);
});
test('actual superadmin auth requires explicit tenant selection and respects denied marketplace capability',async()=>{
  const patch={role:'super-admin',tenantId:null,tenantSlug:null,permissions:[]};const f=authFixture(patch);
  assert.equal((await f.h.GET(authRequest())).status,400);assert.equal(f.reads,0);assert.equal((await f.h.GET(authRequest('GET','?tenant=canonical-qa'))).status,200);
  const denied=authFixture({...patch,deniedPermissions:['marketplace:read','marketplace:write']});for(const method of ['GET','POST'])assert.equal((await denied.h[method](authRequest(method,'?tenant=canonical-qa'))).status,403);assert.equal(denied.reads,0);
});
test('bounded JSON and unavailable source errors remain explicit without writes or raw errors',async()=>{
  const principal={scope:'tenant_admin',tenantId:randomUUID(),tenantSlug:'canonical-qa'};let writes=0;
  const query=async strings=>{if(strings.join('').includes('FROM tenants'))return[{id:principal.tenantId,slug:principal.tenantSlug}];writes++;throw Error('private internal SQL detail')};
  const h=createCatalogHandlers({authorize:async()=>null,principal:()=>principal,query});
  let r=await h.POST(new Request('https://api.example.invalid/admin/consumer-network/catalog',{method:'POST',headers:{'content-type':'application/json','content-length':'25000'},body:'{}'}));assert.equal(r.status,413);assert.equal(writes,0);
  r=await h.GET(new Request('https://api.example.invalid/admin/consumer-network/catalog'));assert.equal(r.status,503);assert.equal((await r.json()).reason,'catalog_unavailable');
});
test('PostgreSQL QA requires an explicit verified isolated connection factory before any DDL',async()=>{
  await assert.rejects(runTenantMarketplaceCatalogPostgresQa(),/explicit verified/);
  const statements=[];let ended=false;await assert.rejects(runTenantMarketplaceCatalogPostgresQa({connect:async()=>({query:async text=>{statements.push(text);return{rows:[{database:'production',role:'nexid_e2e',address:'127.0.0.1'}]}},end:async()=>{ended=true}})}));
  assert.equal(statements.length,1);assert.doesNotMatch(statements[0],/CREATE|INSERT|UPDATE|DROP/);assert.equal(ended,true);
});
