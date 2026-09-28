import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePilotScope, parsePilotBatches, buildPilotLaunchpad, filterPilotBatches } from '../src/lib/pilot-launchpad-model.ts';
const tenant = { role:'tenant-admin',tenantSlug:'qa-company',permissions:['batches:read'],deniedPermissions:[],isDemo:false };
const root = { ...tenant,role:'super-admin',tenantSlug:null,permissions:['*'] };
const raw = (patch={}) => ({ id:'10000000-0000-4000-8000-000000000001',bid:'LOT-A',tenant_slug:'qa-company',product_name:'Producto Ámbar',sku:'SKU-001',winery:'',carrier_profile_code:'ntag424',status:'active',quantity:12,active_tags:3,inactive_tags:8,revoked_tags:1,requested_quantity:20,editorial_managed:true,...patch });
const ready = (rows=[raw()]) => ({ state:'ready',rows:parsePilotBatches(rows,'qa-company'),checkedAt:'2026-09-28T12:00:00.000Z' });
test('global scope requires an explicit company and rejects duplicate selectors',()=>{
 assert.equal(resolvePilotScope(root).state,'tenant_required');
 assert.deepEqual(resolvePilotScope(root,' QA-COMPANY '),{state:'selected',tenant:'qa-company',canSelect:true});
 for(const q of [['qa-company'],['qa-company','other'],{},'../other','https://other','a/b'])assert.equal(resolvePilotScope(root,q).state,'invalid');
});
test('company session remains bound to its tenant, even with broad grants',()=>{
 assert.equal(resolvePilotScope(tenant).tenant,'qa-company');assert.equal(resolvePilotScope(tenant,'other').state,'forbidden');
 assert.equal(resolvePilotScope({...root,tenantSlug:'qa-company'},'other').state,'forbidden');
 assert.equal(resolvePilotScope({...tenant,tenantSlug:null}).state,'forbidden');
});
for(const access of [{...tenant,isDemo:true},{...root,deniedPermissions:['batches:read']},{...root,role:'invented'},{...tenant,role:'supplier-operator'}])test('unavailable access causes no selectable scope '+JSON.stringify(access),()=>assert.notEqual(resolvePilotScope(access,'qa-company').state,'selected'));
test('source retains exact batch measurements without deriving physical or editorial completion',()=>{
 const parsed=parsePilotBatches([raw({has_meta_key:true,has_file_key:true,secret:'PRIVATE',profile:{assetScore:100},qa_passed:99,tx_hash:'0x123'})],'qa-company');
 const model=buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),{...ready(),rows:parsed});
 assert.equal(model.batches[0].quantity,12);assert.equal(model.batches[0].active,3);
 assert.doesNotMatch(JSON.stringify(model),/PRIVATE|assetScore|qa_passed|tx_hash|progress|completed|has_meta_key/);
 assert.equal(model.batches[0].tasks[0].view,'passport');assert.equal(model.batches[0].tasks[0].href,'/batches/LOT-A/passport?tenant=qa-company');
});
for(const patch of [{tenant_slug:'foreign'},{bid:'../bad'},{bid:'a%2fb'},{bid:'x?tenant=foreign'},{id:'bad'},{quantity:null},{quantity:-1},{active_tags:13},{revoked_tags:'1'},{demo:true},{demoMode:true},{is_demo:true},{dataSource:'synthetic'}])test('invalid row rejects the entire sample '+JSON.stringify(patch),()=>assert.throws(()=>parsePilotBatches([raw(),raw({id:'10000000-0000-4000-8000-000000000002',bid:'LOT-B',...patch})],'qa-company')));
test('duplicates and oversized collections cannot inflate the sample',()=>{
 assert.throws(()=>parsePilotBatches([raw(),raw()],'qa-company'));assert.throws(()=>parsePilotBatches([raw(),raw({bid:'LOT-B'})],'qa-company'));assert.throws(()=>parsePilotBatches(Array.from({length:301},()=>raw()),'qa-company'));
 assert.deepEqual(parsePilotBatches([],'qa-company'),[]);
});
test('denied and unavailable responses never restore cached selections or show false counts',()=>{
 for(const state of ['forbidden','unavailable','invalid','timeout']){const model=buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),{state,rows:null,checkedAt:'2026-09-28T12:00:00Z'});assert.equal(model.state,state);assert.deepEqual(model.batches,[]);}
 const empty=buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),ready([]));assert.equal(empty.state,'ready');assert.deepEqual(empty.batches,[]);
});
test('task and company links obey existing permission boundaries and never add tokenization prerequisites',()=>{
 const model=buildPilotLaunchpad(tenant,resolvePilotScope(tenant),ready());
 assert.ok(model.batches[0].tasks.find(t=>t.view==='passport').href);
 assert.ok(model.batches[0].tasks.find(t=>t.view==='traceability').href);assert.equal(model.batches[0].tasks.find(t=>t.view==='recalls').href,null);
 assert.equal(model.links.report,null);assert.equal(model.links.reception,null);assert.equal(model.links.usage,null);
 assert.ok(model.links.editorial.endsWith('?tenant=qa-company'));
 for(const href of Object.values(buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),ready()).links).filter(Boolean))assert.ok(!href.includes('tokenization')&&!href.includes('proof'));
});
test('foreign preprojected source fails closed and local search does not alter selection data',()=>{
 const source=ready();source.rows[0].tenant='other';assert.equal(buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),source).state,'invalid');
 const model=buildPilotLaunchpad(root,resolvePilotScope(root,'qa-company'),ready());const before=structuredClone(model.batches);
 assert.equal(filterPilotBatches(model.batches,'ambar sku').length,1);assert.equal(filterPilotBatches(model.batches,'missing').length,0);assert.deepEqual(model.batches,before);
});
