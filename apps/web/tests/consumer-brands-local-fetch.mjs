// Layer only the brands QA projections over the guarded existing local adapter.
import './consumer-portal-local-fetch.mjs';
import { consumerBrandsFixture } from './consumer-brands-fixture.mjs';
if(process.env.CONSUMER_PORTAL_QA!=='1'||process.env.CONSUMER_BRANDS_QA!=='1')throw Error('consumer_brands_fixture_requires_explicit_local_qa');
const guarded=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=input instanceof Request?input.url:String(input);
 const result=consumerBrandsFixture(url,{method:init?.method||(input instanceof Request?input.method:'GET'),headers:init?.headers||(input instanceof Request?input.headers:undefined)});
 return result?Response.json(result.body,{status:result.status,headers:{'cache-control':'private, no-store'}}):guarded(input,init);
};
