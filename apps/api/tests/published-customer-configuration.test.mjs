import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
import {getPublishedCustomerConfiguration} from '../src/lib/published-customer-configuration.ts';
const tenantId=randomUUID(),programId=randomUUID();
function fixture({settings,program,catalog=false,duplicate=false,failedCatalog=false,eventId='42',empty=false,missingTenant=false}={}){
  const calls=[],triviaCalls=[];return {calls,triviaCalls,overrides:{readTrivia:async(actualEventId,p)=>{triviaCalls.push({eventId:actualEventId,programId:p.id});assert.equal(actualEventId,eventId);assert.equal(p.tenant_id,tenantId);return null},query:async(strings,...values)=>{
    const s=strings.join('?');calls.push({s,values});
    if(s.includes('FROM events'))return Array.from({length:empty?0:duplicate?2:1},()=>({tenant_id:missingTenant?null:tenantId,tenant_slug:'canonical-qa',metadata:{postTap:settings,privateSecret:'synthetic-hidden'}}));
    assert(values.includes(tenantId),'All follow-up reads use the persisted event tenant');
    if(s.includes('FROM loyalty_programs'))return program?[{id:programId,tenant_id:tenantId,name:'Club QA',points_name:'Puntos QA',rules_json:program,private_member:'hidden'}]:[];
    if(s.includes('marketplace_products')){if(failedCatalog)throw Error('synthetic catalog error');return [{available:catalog}]}
    throw Error('unexpected statement');
  }}};
}
test('missing publication creates no implicit brand services',async()=>{
  const f=fixture();const c=await getPublishedCustomerConfiguration('42',f.overrides);assert.equal(c.status,'unpublished');assert.deepEqual(c.allowedActions,[]);assert.equal(c.program,null);assert.equal(c.trivia,null);
});
test('public publication projects only allowlisted services and catalog proof',async()=>{
  const f=fixture({settings:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:['lead','marketplace','secretAction']},program:{pointsPerValidTap:0,secretCoupon:'hidden'}});
  const c=await getPublishedCustomerConfiguration('42',f.overrides);assert.deepEqual(c.allowedActions,['lead']);assert.equal(c.program.pointsPerValidTap,0);assert(!JSON.stringify(c).includes('hidden'));assert.equal(c.catalogAvailable,false);assert.equal(c.tenantSlug,'canonical-qa');
});
test('catalog read failure cannot fabricate availability or disable an independently published contact',async()=>{
  const f=fixture({settings:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:['lead','marketplace']},failedCatalog:true});
  const c=await getPublishedCustomerConfiguration('42',f.overrides);assert.deepEqual(c.allowedActions,['lead']);assert.equal(c.catalogAvailable,false);
});
test('withdrawn profile does not withdraw a separately published program',async()=>{
  const f=fixture({settings:{version:'nexid.tenant-actions.v1',status:'paused',allowedActions:['lead']},program:{pointsPerValidTap:0}});
  const c=await getPublishedCustomerConfiguration('42',f.overrides);assert.equal(c.status,'unpublished');assert.deepEqual(c.allowedActions,[]);assert.equal(c.program.id,programId);
});
test('unsupported historical TAP points cannot advertise a payable amount',async()=>{
  for(const pointsPerValidTap of [10001,-1,0.5,'10',null]){
    const f=fixture({program:{pointsPerValidTap}});const c=await getPublishedCustomerConfiguration('42',f.overrides);
    assert.equal(c.program.pointsPerValidTap,null);
  }
});
test('ambiguous or invalid event never selects a tenant or performs follow-up reads',async()=>{
  const f=fixture({duplicate:true});await assert.rejects(getPublishedCustomerConfiguration('42',f.overrides),/ambiguous/);assert.equal(f.calls.length,1);
  for(const eventId of ['0','-1','42; SELECT 1','9223372036854775808'])await assert.rejects(getPublishedCustomerConfiguration(eventId,f.overrides),/invalid/);assert.equal(f.calls.length,1);
});


// Literal expectations deliberately do not reuse the production predicate.
const configurationPositiveIds = ['1','42','715','9007199254740991','9007199254740992','9007199254740993','9223372036854775806','9223372036854775807'];
const configurationNegativeIds = [
  ['above bigint max','9223372036854775808'],['nineteen nines','9999999999999999999'],['twenty digits','10000000000000000000'],['oversized','1'.repeat(1000)],
  ['zero','0'],['double zero','00'],['leading zero','01'],['positive sign','+1'],['negative sign','-1'],['fraction','1.0'],['exponent','1e3'],['hex','0x1'],
  ['leading space',' 1'],['trailing space','1 '],['trailing newline','1\n'],['trailing CRLF','1\r\n'],['tab','1\t'],['NUL','1\0'],['unicode Arabic digit','١'],['unicode fullwidth digit','１'],
  ['slash','1/2'],['query','1?x=2'],['fragment','1#2'],['empty',''],['missing',undefined],['null',null],['number',42],['bigint',42n],['boolean',true],['NaN',NaN],['Infinity',Infinity],['symbol',Symbol('42')],['function',()=>42],['array',['42']],['object',{}],['boxed string',new String('42')],
];

for (const eventId of configurationPositiveIds) test('configuration preserves exact service SQL and trivia string '+eventId,async()=>{
  const f=fixture({eventId,program:{pointsPerValidTap:0}}), result=await getPublishedCustomerConfiguration(eventId,f.overrides);
  const eventRead=f.calls.find(call=>call.s.includes('FROM events'));
  assert.equal(eventRead.values.length,1);assert.equal(typeof eventRead.values[0],'string');assert.equal(eventRead.values[0],eventId);
  assert.equal(f.triviaCalls.length,1);assert.equal(typeof f.triviaCalls[0].eventId,'string');assert.equal(f.triviaCalls[0].eventId,eventId);
  assert.equal(f.triviaCalls[0].programId,programId);assert.equal(result.program.id,programId);
  assert(f.calls.slice(1).every(call=>call.values.includes(tenantId)),'Persisted event tenant remains authoritative');
});

for (const [label,eventId] of configurationNegativeIds) test('configuration invalid '+label+' rejects before any SQL or trivia',async()=>{
  const f=fixture({program:{pointsPerValidTap:0}});
  await assert.rejects(getPublishedCustomerConfiguration(eventId,f.overrides),error=>error instanceof Error&&error.message==='configuration_event_invalid');
  assert.equal(f.calls.length,0);assert.equal(f.triviaCalls.length,0);
});

test('configuration never coerces an object and still rejects absent or tenantless persisted events',async()=>{
  let coercions=0;const value={toString(){coercions++;throw Error('must not coerce');}};
  const invalid=fixture();await assert.rejects(getPublishedCustomerConfiguration(value,invalid.overrides),/configuration_event_invalid/);assert.equal(coercions,0);assert.equal(invalid.calls.length,0);
  for(const option of [{empty:true},{missingTenant:true}]){const f=fixture(option);await assert.rejects(getPublishedCustomerConfiguration('42',f.overrides),/configuration_event_not_found/);assert.equal(f.calls.length,1);assert.equal(f.triviaCalls.length,0);}
});

// Execute the actual route module with controlled external boundaries. The new
// pure helper is loaded only if this actual module imports it; old-source
// baselines therefore fail on business assertions, never on a missing new file.
const routeText=()=>readFileSync(new URL('../src/app/public/passport/[eventId]/configuration/route.ts',import.meta.url),'utf8');
function loadConfigurationModule(text,dependencies){
  const module={exports:{}};
  const compiled=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',compiled)(name=>{
    const key=name.split('/').at(-1);
    if(key==='configuration-event-id')return loadConfigurationModule(readFileSync(new URL('../src/lib/configuration-event-id.ts',import.meta.url),'utf8'),{});
    assert(Object.hasOwn(dependencies,key),'Unexpected actual-route dependency '+name);return dependencies[key];
  },module,module.exports);
  return module.exports;
}
function configurationRouteFixture({limited=false,serviceError=false,encodedPath='42'}={}){
  const calls={order:[],rate:[],service:[]},request=new Request('https://nexid.lat/public/passport/'+encodedPath+'/configuration');
  const configuration={version:'nexid.tenant-actions.v1',status:'unpublished',allowedActions:[],program:null,trivia:null,catalogAvailable:false,tenantSlug:null};
  const limitedResponse=Response.json({ok:false,reason:'synthetic_rate_limit'},{status:429,headers:{'retry-after':'17'}});
  const route=loadConfigurationModule(routeText(),{
    'published-customer-configuration':{getPublishedCustomerConfiguration:async eventId=>{calls.order.push('service');calls.service.push(eventId);if(serviceError)throw Error('owned failure');return configuration;},unavailableCustomerConfiguration:()=>({...configuration,status:'unavailable'})},
    'critical-rate-limit':{enforceCriticalRateLimit:async(req,options)=>{calls.order.push('rate');assert.equal(req,request);calls.rate.push(options);return limited?limitedResponse:null;}},
  });
  assert.deepEqual(Object.keys(route).sort(),['GET','dynamic','runtime']);assert.equal(route.runtime,'nodejs');assert.equal(route.dynamic,'force-dynamic');
  return{calls,configuration,limitedResponse,get:eventId=>route.GET(request,{params:Promise.resolve({eventId})})};
}

for(const eventId of configurationPositiveIds)test('actual configuration route preserves exact string and rate order '+eventId,async()=>{
  const f=configurationRouteFixture(),response=await f.get(eventId);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.deepEqual(await response.json(),{ok:true,configuration:f.configuration});assert.deepEqual(f.calls.order,['rate','service']);
  assert.deepEqual(f.calls.rate,[{rateClass:'public',tenantId:'platform',subjectId:'public-customer-configuration'}]);assert.deepEqual(f.calls.service,[eventId]);assert.equal(typeof f.calls.service[0],'string');
});

for(const [label,eventId] of configurationNegativeIds)test('actual configuration route invalid '+label+' makes no rate or service call',async()=>{
  const f=configurationRouteFixture(),response=await f.get(eventId);assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.deepEqual(await response.json(),{ok:false,reason:'configuration_event_invalid'});assert.deepEqual(f.calls.order,[]);assert.equal(f.calls.rate.length,0);assert.equal(f.calls.service.length,0);
});

test('actual route keeps decoded canonical digits, rate refusal and unavailable envelopes',async()=>{
  let coercions=0;const raw={toString(){coercions++;throw Error('route must not coerce');}},nonString=configurationRouteFixture();assert.equal((await nonString.get(raw)).status,400);assert.equal(coercions,0);assert.deepEqual(nonString.calls.order,[]);
  const decoded=configurationRouteFixture({encodedPath:'%31'});assert.equal((await decoded.get('1')).status,200);assert.deepEqual(decoded.calls.service,['1']);
  const limited=configurationRouteFixture({limited:true}),response=await limited.get('9007199254740993');assert.equal(response,limited.limitedResponse);assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'17');assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.deepEqual(limited.calls.order,['rate']);assert.equal(limited.calls.service.length,0);
  const unavailable=configurationRouteFixture({serviceError:true}),failed=await unavailable.get('9223372036854775807');assert.equal(failed.status,503);assert.equal(failed.headers.get('cache-control'),'private, no-store, max-age=0');assert.deepEqual(await failed.json(),{ok:false,reason:'configuration_unavailable',configuration:{...unavailable.configuration,status:'unavailable'}});assert.deepEqual(unavailable.calls.order,['rate','service']);
});
