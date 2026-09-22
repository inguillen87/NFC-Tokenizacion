import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import {handleSupportReport} from '../src/lib/support-report-http.ts';
import {signSupportReportCapability} from '../src/lib/support-report-capability.ts';
import {createSunFreshHandoffToken} from '../src/lib/sun-fresh-handoff.ts';
import {SupportReportError} from '../src/lib/support-report-service.ts';

process.env.SUN_HANDOFF_SECRET='SYNTHETIC-S9-ROUTE-SECRET-NEVER-PRODUCTION-12345';
const scope={eventId:'715',tenantId:'10000000-0000-4000-8000-000000000001',batchId:'20000000-0000-4000-8000-000000000001',tenantSlug:'qa',bid:'QA-ONLY',uid:'04AABBCCDDEEFF',counter:107};
const body=()=>({bid:scope.bid,event_id:scope.eventId,support_token:signSupportReportCapability(scope).token,request_id:'30000000-0000-4000-8000-000000000001',category:'tap_review',description:'QA report',locale:'es-AR'});
const request=value=>new Request('https://api.example/public/cta/report-problem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
const result={ok:true,ticket_created:true,outcome:'ticket_created',eventId:'715',bid:scope.bid,ticket:{id:'50000000-0000-8000-8000-000000000001',status:'open',created_at:'2026-01-01T00:00:00Z',tenant_assigned:true}};
function deps(patch={}){return{limit:async()=>null,load:async()=>scope,write:async()=>result,companions:async()=>{},...patch};}

test('public route requires dedicated support authority and never replaces it with share/fresh or fallback identity',async()=>{
  let writes=0,loads=0;const dependencies=deps({load:async()=>{loads++;return scope;},write:async()=>{writes++;return result;}});
  const missing=body();delete missing.support_token;
  assert.equal((await handleSupportReport(request(missing),undefined,dependencies)).status,403);assert.equal(loads,0);
  const denials=[];
  for(const patch of [{support_token:'invalid'},{bid:'OTHER'},{event_id:'999'}]){
    const actual=deps({...dependencies,load:async id=>id==='715'?scope:null});
    const denied=await handleSupportReport(request({...body(),...patch}),undefined,actual);
    assert.equal(denied.status,403);denials.push(await denied.json());
  }
  assert.deepEqual(denials,[denials[0],denials[0],denials[0]]);
  assert.equal((await handleSupportReport(request({...body(),uid:scope.uid}),undefined,dependencies)).status,400);
  assert.equal(writes,0);
  const response=await handleSupportReport(request(body()),undefined,dependencies);assert.equal(response.status,201);assert.equal(writes,1);
  assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).ticket_created,true);
});

test('expired credentials, malformed fields, unavailable scope and DB failure cannot confirm a ticket',async()=>{
  const expired=signSupportReportCapability(scope,Date.now()-901000).token;
  assert.equal((await handleSupportReport(request({...body(),support_token:expired}),undefined,deps())).status,403);
  assert.equal((await handleSupportReport(request({...body(),description:''}),undefined,deps())).status,400);
  assert.equal((await handleSupportReport(request({...body(),description:'x'.repeat(9000)}),undefined,deps())).status,413);
  const response=await handleSupportReport(request(body()),undefined,deps({write:async()=>{throw Error('private SQL contact token');}}));
  assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private SQL|contact|token_created/);
  const conflict=await handleSupportReport(request(body()),undefined,deps({write:async()=>{throw new SupportReportError('report_request_conflict',409);}}));assert.equal(conflict.status,409);
});

test('committed tickets survive failed companions; retries return existing ticket and skip companions',async()=>{
  let companionCalls=0;const dependencies=deps({companions:async()=>{companionCalls++;throw Error('analytics unavailable');}});
  const response=await handleSupportReport(request(body()),undefined,dependencies);assert.equal(response.status,201);assert.equal((await response.json()).ticket_created,true);
  const retry=await handleSupportReport(request(body()),undefined,deps({...dependencies,write:async()=>({...result,outcome:'ticket_existing',ticket:{...result.ticket,status:'pending'}})}));
  assert.equal(retry.status,200);assert.equal((await retry.json()).outcome,'ticket_existing');assert.equal(companionCalls,1);
});

test('mobile uses server consumer identity and verifies fresh capability without spending it before persistence',async()=>{
  const mobile={id:'40000000-0000-4000-8000-000000000001',eventId:'715'};
  let attempts=0;
  const fresh=createSunFreshHandoffToken({eventId:'715',bid:scope.bid,uidHex:scope.uid,readCounter:scope.counter,diagnosticId:510,traceId:'qa',exp:Math.floor(Date.now()/1000)+300});
  const payload=body();delete payload.support_token;payload.fresh_token=fresh;
  const dependencies=deps({write:async(current,actor)=>{assert.deepEqual(actor,{source:'consumer_portal_report',consumerId:mobile.id});if(++attempts===1)throw Error('database unavailable');return result;}});
  assert.equal((await handleSupportReport(request(payload),mobile,dependencies)).status,503);
  assert.equal((await handleSupportReport(request(payload),mobile,dependencies)).status,201);
  assert.equal(attempts,2);
  assert.equal((await handleSupportReport(request({...payload,event_id:'716'}),mobile,dependencies)).status,409);
  assert.equal((await handleSupportReport(request({...payload,support_token:'invalid'}),mobile,dependencies)).status,403);
});

function compileFunction(source,name,bindings){const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(node);const js=ts.transpileModule(node.getText(ast).replace(/^export\s+/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;return new Function(...Object.keys(bindings),js+`;return ${name};`)(...Object.values(bindings));}
test('actual mobile route authenticates and enforces origin before invoking the shared writer',async()=>{
  const source=await readFile(new URL('../src/app/mobile/passport/[eventId]/consumer/report-problem/route.ts',import.meta.url),'utf8');
  let allowed=true,consumer=null,writes=0;
  const route=compileFunction(source,'POST',{json:(value,status,headers)=>Response.json(value,{status,headers}),enforceConsumerMutationOrigin:()=>allowed?null:new Response(null,{status:403}),getConsumerFromRequest:async()=>consumer,handleSupportReport:async()=>{writes++;return Response.json(result);}});
  const ctx={params:Promise.resolve({eventId:'715'})};
  assert.equal((await route(request(body()),ctx)).status,401);allowed=false;consumer={id:'qa'};
  assert.equal((await route(request(body()),ctx)).status,403);assert.equal(writes,0);
  allowed=true;assert.equal((await route(request(body()),ctx)).status,200);assert.equal(writes,1);
  assert.doesNotMatch(source,/consumeSunFreshHandoff|INSERT INTO tickets/);
});

test('support capability is attached only to responses after diagnostic persistence and snapshot authorization',async()=>{
  const sun=await readFile(new URL('../src/app/sun/route.ts',import.meta.url),'utf8');
  const snapshot=await readFile(new URL('../src/lib/sun-diagnostics.ts',import.meta.url),'utf8');
  const route=await readFile(new URL('../src/app/sun/snapshot/[diagnosticId]/route.ts',import.meta.url),'utf8');
  assert.ok(sun.lastIndexOf('supportReport: await createSupportReportCapability')>sun.lastIndexOf('await insertSunDiagnostic('));
  for(const match of sun.matchAll(/supportReport: await createSupportReportCapability/g)) {
    const response=sun.slice(match.index,match.index+550);
    assert.match(response,/response\.headers\.set\("cache-control", "private, no-store"\)/);
    assert.match(response,/response\.headers\.set\("referrer-policy", "no-referrer"\)/);
  }
  assert.match(snapshot,/publicContract\.supportReport = await createSupportReportCapability\(currentTapEventId\)/);
  assert.ok(route.indexOf('if (!snapshotAccess.ok)')<route.indexOf('await getSunDiagnosticSnapshot('));
  const writer=await readFile(new URL('../src/lib/support-report-service.ts',import.meta.url),'utf8');assert.doesNotMatch(writer,/support_token|fresh_token|consumeSunFreshHandoff/);
});
