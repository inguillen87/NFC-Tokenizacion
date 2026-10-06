import test from 'node:test';
import assert from 'node:assert/strict';
import {consumerBrandsFixture,brandsQaMemberships,brandsQaCatalog} from './consumer-brands-fixture.mjs';
import {parseHistory} from '../src/app/me/taps/history-model.ts';
const request=(path,mode='ready',extra={})=>consumerBrandsFixture('https://api.nexid.lat'+path,{headers:{cookie:`consumer_qa=local; consumer_brands_case=${mode}`},...extra});
test('synthetic identities, individual amounts and managed catalog states are explicit and distinct',()=>{
 assert.deepEqual(brandsQaMemberships.map(row=>[row.slug,row.status,row.points_balance]),[['brand-a','paused',41],['branda','pending',0],['brand_c','active',null]]);
 assert.equal(new Set(brandsQaMemberships.map(row=>row.slug)).size,3);
 assert.deepEqual(brandsQaCatalog.map(row=>row.status||row.stock_status||null),['active','draft','withdrawn',null,'active']);
});
test('fixture never grants a session without the explicit synthetic cookie and blocks writes and unknown cases',()=>{
 assert.equal(consumerBrandsFixture('https://api.nexid.lat/consumer/session').body.authenticated,false);
 assert.equal(consumerBrandsFixture('https://api.nexid.lat/consumer/brands').status,401);
 for(const method of ['POST','PATCH','DELETE'])assert.throws(()=>request('/consumer/brands','ready',{method}),/write_blocked/);
 assert.throws(()=>request('/consumer/brands','unrecognized'),/case_invalid/);
 assert.equal(consumerBrandsFixture('https://other.example.test/consumer/brands'),null);
});
test('empty, failed and malformed membership sources have different successful envelopes or explicit status',()=>{
 assert.deepEqual(request('/consumer/brands','empty'),{status:200,body:{ok:true,items:[]}});
 assert.equal(request('/consumer/brands','brands-unavailable').status,503);
 assert.deepEqual(request('/consumer/brands','brands-malformed').body.items,[{}]);
 assert.equal(request('/consumer/session','session-unavailable').status,503);
});
test('three independent failures preserve the other account sources and tenant catalog filter remains exact',()=>{
 for(const [path,mode] of [['/consumer/products','products-unavailable'],['/consumer/taps','taps-unavailable'],['/marketplace/products','catalog-unavailable']]){
  assert.equal(request(path,mode).status,503);assert.deepEqual(request('/consumer/brands',mode).body.items,brandsQaMemberships);
  for(const other of ['/consumer/products','/consumer/taps','/marketplace/products'].filter(candidate=>candidate!==path))assert.equal(request(other,mode).status,200);
 }
 assert.ok(request('/marketplace/products?tenant=branda').body.items.every(item=>item.tenant_slug==='branda'));
 assert.deepEqual(request('/marketplace/products?tenant=foreign').body.items,[]);
});
test('history destination uses the existing canonical parser and preserves the exact synthetic tenant scope',()=>{
 const query={tenant:'brand_c',from:'',to:'',event:''};
 const parsed=parseHistory(request('/consumer/taps/history?tenant=brand_c').body,{query,page:1});
 assert.deepEqual(parsed.query,query);assert.deepEqual(parsed.items,[]);
 assert.equal(request('/consumer/taps/history?tenant=foreign').status,400);
});
