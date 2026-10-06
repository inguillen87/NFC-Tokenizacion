import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildCatalogCommand,CATALOG_PROTOCOL,catalogContent,catalogErrorCopy,catalogFieldsOf,catalogManaged,catalogPrice,catalogReconciliation,catalogState,catalogVisible,parseTenantCatalog} from '../src/lib/tenant-marketplace.ts';
const id='10000000-0000-4000-8000-000000000001',brandId='20000000-0000-4000-8000-000000000001';
const time='2026-10-06T12:34:56.123456Z',nextTime='2026-10-06T12:34:56.123457Z';
const brand={id:brandId,status:'active',display_name:'Marca QA',slug:'marca.qa',vertical:'cosmetics',description:null,country:null,city:null,visible_in_network:true,updatedAt:time};
const product={id,status:'draft',title:'Producto QA',description:'Contenido de QA',vertical:'cosmetics',category:null,image_url:'/assets/example.png',price_amount:'0.00',price_currency:'USD',external_checkout_url:null,request_to_buy_enabled:false,age_gate_required:false,updatedAt:time};
const board=()=>({ok:true,protocol:CATALOG_PROTOCOL,tenant:'qa-tenant',brand,items:[product],hasMore:false});
const fields=(patch={})=>({...catalogFieldsOf(product,'product'),...patch});

test('catalog parser preserves real data, explicit zero and bounded-list truth without commercial defaults',()=>{
 const data={...board(),items:[{...product,accepts_rewards:false,authenticity_program_badge:false}],hasMore:true};
 assert.deepEqual(parseTenantCatalog(data,'qa-tenant'),data);assert.equal(parseTenantCatalog({...board(),brand:null,items:[]},'qa-tenant').items.length,0);
 assert.equal(catalogFieldsOf(product,'product').priceAmount,'0.00');assert.equal(catalogFieldsOf(product,'product').requestEnabled,'false');
});
test('foreign tenant, unsupported protocol, demo sources and malformed resources remain unavailable',()=>{
 for(const data of[{...board(),tenant:'foreign'},{...board(),protocol:'wrong'},{...board(),demoMode:true},{...board(),dataSource:'demo'},{...board(),hasMore:'yes'},{...board(),items:[product,product]},{...board(),items:[{...product,id:'slug-old'}]},{...board(),items:[{...product,updatedAt:'2026-10-06T12:34:56.123Z'}]},{...board(),items:[{...product,price_amount:0}]},{...board(),items:[{...product,price_currency:null}]},{...board(),brand:{...brand,visible_in_network:undefined}}])assert.equal(parseTenantCatalog(data,'qa-tenant'),null);
 assert.equal(parseTenantCatalog(board(),''),null);
});
test('new drafts use a stable client UUID and explicit booleans, without tenant or reward fields',()=>{
 const fresh={...product,updatedAt:null,title:'',price_amount:null,price_currency:null};
 const command=buildCatalogCommand('product','save_draft',fresh,fields({title:'',priceAmount:'',priceCurrency:'',requestEnabled:'false',ageGateRequired:'true'}));
 assert.equal(command.id,id);assert.equal(command.expectedUpdatedAt,null);assert.equal(command.content.title,'');assert.equal(command.content.price_amount,null);assert.equal(command.content.price_currency,null);assert.equal(command.content.request_to_buy_enabled,false);assert.equal(command.content.age_gate_required,true);
 assert.deepEqual(Object.keys(command.content).sort(),['age_gate_required','category','description','external_checkout_url','image_url','price_amount','price_currency','request_to_buy_enabled','title','vertical'].sort());
 for(const key of['tenant','tenant_id','accepts_rewards','accepts_tenant_points','accepts_network_credits','authenticity_program_badge','featured'])assert.equal(command.content[key],undefined);
 for(const patch of[{requestEnabled:''},{ageGateRequired:''}])assert.throws(()=>buildCatalogCommand('product','save_draft',fresh,fields(patch)),/catalog_invalid/);
});
test('decimal amounts and currency pairs cannot invent prices, round silently or default to ARS',()=>{
 assert.equal(catalogPrice('0'),'0');assert.equal(catalogPrice(''),null);assert.equal(catalogPrice('9999999999.99'),'9999999999.99');
 for(const value of['-1','1.234','1e2','NaN','Infinity','10000000000','1,20','00','01.00'])assert.throws(()=>catalogPrice(value),/catalog_invalid/);
 for(const patch of[{priceAmount:'',priceCurrency:'ARS'},{priceAmount:'0',priceCurrency:''},{priceAmount:'1',priceCurrency:'usd'}])assert.throws(()=>catalogContent('product',fields(patch)),/catalog_invalid/);
 const empty=catalogContent('product',fields({priceAmount:'',priceCurrency:''}));assert.equal(empty.price_amount,null);assert.equal(empty.price_currency,null);
});
test('content accepts explicit public assets or HTTPS while rejecting unsafe checkout destinations',()=>{
 assert.equal(catalogContent('product',fields()).image_url,'/assets/example.png');
 assert.equal(catalogContent('product',fields({externalCheckoutUrl:'https://shop.example.com/product'})).external_checkout_url,'https://shop.example.com/product');
 assert.equal(catalogContent('product',fields({externalCheckoutUrl:'https://shop.example.com'})).external_checkout_url,'https://shop.example.com/');
 for(const url of['javascript:alert(1)','http://shop.example.com','https://user:pass@shop.example.com','https://shop.example.com:444/p','https://shop.example.com/p#token','https://localhost/p','https://127.0.0.1/p','https://10.0.0.1/p','https://192.168.1.1/p','https://172.16.0.1/p','https://8.8.8.8/p','https://shop.example.com/a b'])assert.throws(()=>catalogContent('product',fields({externalCheckoutUrl:url})),/catalog_invalid/);
 for(const imageUrl of['/assets/../private','//foreign.example.com/image','/assets/a.png?private=1'])assert.throws(()=>catalogContent('product',fields({imageUrl})),/catalog_invalid/);
});
test('API-sized persisted links and form commands accept 2048 characters and reject 2049',()=>{
 const prefix='https://shop.example.com/',accepted=prefix+'a'.repeat(2048-prefix.length),rejected=accepted+'a';
 assert.equal(accepted.length,2048);
 for(const [field,input]of[['image_url','imageUrl'],['external_checkout_url','externalCheckoutUrl']]){
  assert.ok(parseTenantCatalog({...board(),items:[{...product,[field]:accepted}]},'qa-tenant'));
  assert.equal(parseTenantCatalog({...board(),items:[{...product,[field]:rejected}]},'qa-tenant'),null);
  assert.equal(catalogContent('product',fields({[input]:accepted}))[field],accepted);
  assert.throws(()=>catalogContent('product',fields({[input]:rejected})),/catalog_invalid/);
 }
});

test('publication and withdrawal send only saved identity/timestamp, with explicit brand network consent',()=>{
 const savedBrand={...brand,status:'draft',visible_in_network:false};
 assert.deepEqual(buildCatalogCommand('brand','publish',savedBrand,catalogFieldsOf(savedBrand,'brand')),{kind:'brand',action:'publish',id:brandId,expectedUpdatedAt:time,visible_in_network:true});
 assert.deepEqual(buildCatalogCommand('product','publish',product,fields()),{kind:'product',action:'publish',id,expectedUpdatedAt:time});
 assert.deepEqual(buildCatalogCommand('product','withdraw',{...product,status:'active'},fields({title:'local unsaved'})),{kind:'product',action:'withdraw',id,expectedUpdatedAt:time});
 for(const action of['save_draft','publish'])assert.throws(()=>buildCatalogCommand('product',action,{...product,status:'active'},fields()),/catalog_withdraw_required/);
 assert.throws(()=>buildCatalogCommand('product','publish',{...product,updatedAt:null},fields()),/catalog_invalid/);
 assert.throws(()=>buildCatalogCommand('product','withdraw',product,fields()),/catalog_invalid/);
 assert.throws(()=>buildCatalogCommand('brand','save_draft',product,fields()),/catalog_invalid/);
});
test('exact microsecond timestamps survive commands and readbacks without Date conversion',()=>{
 const command=buildCatalogCommand('product','save_draft',product,fields({title:'Cambio'}));assert.equal(command.expectedUpdatedAt,time);
 assert.equal(catalogReconciliation(product,command,product),'retry_allowed');
 assert.equal(catalogReconciliation({...product,updatedAt:nextTime},command,product),'changed');
 assert.equal(catalogReconciliation({...product,title:'Cambio',updatedAt:nextTime},command,product),'matches');
 assert.throws(()=>buildCatalogCommand('product','save_draft',{...product,updatedAt:'2026-10-06T12:34:56.123Z'},fields()),/catalog_invalid/);
});
test('lost-create reconciliation requires the exact UUID, content and final state; retry uses the same UUID',()=>{
 const baseline={...product,updatedAt:null};const command=buildCatalogCommand('product','save_draft',baseline,fields({priceAmount:'0'}));
 assert.equal(catalogReconciliation(null,command,baseline),'retry_allowed');assert.equal(catalogReconciliation({...product,updatedAt:nextTime},command,baseline),'matches');
 for(const patch of[{id:brandId},{title:'Different'},{age_gate_required:true},{status:'active'},{request_to_buy_enabled:true},{price_currency:'ARS'}])assert.equal(catalogReconciliation({...product,updatedAt:nextTime,...patch},command,baseline),'changed');
 assert.equal(command.id,id);assert.equal(command.expectedUpdatedAt,null);
});
test('brand publication and withdrawal readback require matching profile content and visibility',()=>{
 const baseline={...brand,status:'draft',visible_in_network:false};const publish=buildCatalogCommand('brand','publish',baseline,catalogFieldsOf(baseline,'brand'));
 assert.equal(catalogReconciliation({...brand,updatedAt:nextTime},publish,baseline),'matches');
 assert.equal(catalogReconciliation({...brand,visible_in_network:false,updatedAt:nextTime},publish,baseline),'changed');
 assert.equal(catalogReconciliation({...brand,display_name:'Foreign presentation',updatedAt:nextTime},publish,baseline),'changed');
 const withdrawal=buildCatalogCommand('brand','withdraw',brand,catalogFieldsOf(brand,'brand'));
 assert.equal(catalogReconciliation({...brand,status:'withdrawn',visible_in_network:false,updatedAt:nextTime},withdrawal,brand),'matches');
});
test('withdrawal readback retains historical product fields even when older content is no longer publishable',()=>{
 const historical={...product,status:'active',external_checkout_url:'http://old.example.com'};const command=buildCatalogCommand('product','withdraw',historical,catalogFieldsOf(historical,'product'));
 assert.equal(catalogReconciliation({...historical,status:'withdrawn',updatedAt:nextTime},command,historical),'matches');
});
test('visibility dependency distinguishes published-hidden products from publicly available catalog entries',()=>{
 assert.equal(catalogVisible(brand),true);for(const profile of[null,{...brand,status:'draft'},{...brand,visible_in_network:false}]){assert.equal(catalogVisible(profile),false);assert.equal(catalogState({...product,status:'active'},profile),'Publicado · oculto por la marca');}
 assert.equal(catalogState({...product,status:'withdrawn'},brand),'Retirado');assert.equal(catalogState(product,brand),'Borrador');
});
test('legacy blocked, suspended or unknown statuses remain visible and read-only without tenant reactivation',()=>{
 for(const status of['blocked','suspended','paused','archived','legacy-unclassified']){
  const row={...product,status},profile={...brand,status};assert.ok(parseTenantCatalog({...board(),items:[row],brand:profile},'qa-tenant'));assert.equal(catalogManaged(row),false);assert.equal(catalogManaged(profile),false);assert.equal(catalogState(row,profile),'Revisión autorizada requerida');
  for(const action of['save_draft','publish','withdraw']){assert.throws(()=>buildCatalogCommand('product',action,row,fields()),/catalog_invalid/);assert.throws(()=>buildCatalogCommand('brand',action,profile,catalogFieldsOf(profile,'brand')),/catalog_invalid/);}
 }
});
test('errors preserve work and never expose raw infrastructure details',()=>{
 assert.match(catalogErrorCopy('catalog_revision_conflict'),/formulario sigue aquí/);assert.match(catalogErrorCopy('catalog_withdraw_required'),/Retirá/);assert.match(catalogErrorCopy('catalog_forbidden'),/permiso/);assert.match(catalogErrorCopy('catalog_state_not_managed'),/revisión autorizada/);assert.doesNotMatch(catalogErrorCopy('postgres_password_secret'),/postgres_password_secret/);
});
test('server page checks canonical scope before private reads, excludes demo and passes permission-bound props',async()=>{
 const page=await readFile(new URL('../src/app/(app)/consumer-network/marketplace/page.tsx',import.meta.url),'utf8');const start=page.indexOf('export default');const body=page.slice(start);
 assert.ok(body.indexOf('requireDashboardSession("marketplace:read")')<body.indexOf('createAdminPageContext(session, query.tenant)'));assert.ok(body.indexOf('createAdminPageContext(session, query.tenant)')<body.indexOf('dashboardFetch(url'));assert.match(body,/context\.tenantSlug && !session\.isDemo/);assert.match(body,/parseTenantCatalog\(body, context\.tenantSlug\)/);assert.match(body,/dashboardPermissionDenied/);assert.doesNotMatch(body,/demobodega|globalStore|new Date/);
});
