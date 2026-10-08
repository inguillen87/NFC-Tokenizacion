import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSommelierDemoSession,handleSommelierChat } from '../src/lib/sommelier-http.ts';
const env={NODE_ENV:'production',RATE_LIMIT_KEY_PEPPER:'sommelier-http-synthetic-pepper-0123456789abcdef',NEXID_SOMMELIER_ENABLED:'true',NEXID_SOMMELIER_DEMO_ENABLED:'true'};
const headers={origin:'https://nexid.lat','user-agent':'Synthetic browser','x-vercel-forwarded-for':'203.0.113.8','content-type':'application/json'};
const req=(path,body,extra={})=>new Request('https://api.nexid.lat'+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
const issueBody={profile:'valle-secreto',locale:'es-AR'};
const chatBody={mode:'demo',locale:'es-AR',question:'¿Qué regalo puedo elegir?',history:[]};
const rows=async(strings,...values)=>[{hits:String(values[2]),retry_after:60}];
async function issue(extra={}){const response=await handleSommelierDemoSession(req('/public/sommelier/demo/session',issueBody),{env,query:rows,...extra});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
test('feature flags disabled by default never mint or query a provider',async()=>{
  let queries=0;
  assert.equal((await handleSommelierDemoSession(req('/public/sommelier/demo/session',issueBody),{env:{...env,NEXID_SOMMELIER_ENABLED:undefined},query:async()=>{queries++;return[]}})).status,503);
  assert.equal(queries,0);
});
test('only fixed profile can mint; valid grant reuses expiry without additional quotas/cookie',async()=>{
  let count=0;const query=async(...args)=>{count++;return rows(...args)};
  assert.equal((await handleSommelierDemoSession(req('/public/sommelier/demo/session',{...issueBody,profile:'other'}),{env,query})).status,400);assert.equal(count,0);
  const cookie=await issue({query});assert.equal(count,3);
  const reused=await handleSommelierDemoSession(req('/public/sommelier/demo/session',issueBody,{cookie,'x-vercel-forwarded-for':'203.0.113.9'}),{env,query});
  assert.equal(reused.status,200);assert.equal(count,3);assert.equal(reused.headers.get('set-cookie'),null);
});
test('new grant after cookie deletion counts issuance again with same stable source budget',async()=>{
  const scopes=[];const query=async(strings,...values)=>{scopes.push(values.slice(0,2));return rows(strings,...values)};
  const a=await issue({query}),b=await issue({query});assert.notEqual(a,b);assert.deepEqual(scopes.slice(0,3),scopes.slice(3));
});
test('demo real-event injection/foreign origin/missing grant spend no provider budget',async()=>{
  let calls=0;const deps={env,query:rows,provider:async()=>{calls++;throw Error('must not spend')}};
  assert.equal((await handleSommelierChat(req('/sommelier/chat',{...chatBody,eventId:'733'}),deps)).status,400);
  assert.equal((await handleSommelierChat(req('/sommelier/chat',chatBody,{origin:'https://evil.test'}),deps)).status,403);
  assert.equal((await handleSommelierChat(req('/sommelier/chat',chatBody),deps)).status,401);assert.equal(calls,0);
});
test('quota/store denial never reaches provider and response is non-cacheable',async()=>{
  const cookie=await issue();let calls=0;
  for(const query of [async()=>{throw Error('missing table')},async()=>[{hits:'1000',retry_after:3}]]){
    const response=await handleSommelierChat(req('/sommelier/chat',chatBody,{cookie}),{env,query,provider:async()=>{calls++;throw Error('must not spend')}});
    assert.ok([503,429].includes(response.status));assert.equal(response.headers.get('cache-control'),'no-store');
  }assert.equal(calls,0);
});
test('grant survives authenticated API egress changes, wrong UA still fails',async()=>{
  const cookie=await issue();let context;
  const provider=async(input,ctx)=>{context=ctx;return{ok:true,answer:'synthetic',source:'fallback',fallback:true}};
  assert.equal((await handleSommelierChat(req('/sommelier/chat',chatBody,{cookie,'x-vercel-forwarded-for':'203.0.113.99'}),{env,query:rows,provider})).status,200);
  assert.equal(context.source,'valle_secreto_demo');assert.equal(context.demo,true);
  assert.equal((await handleSommelierChat(req('/sommelier/chat',chatBody,{cookie,'user-agent':'Changed'}),{env,query:rows,provider})).status,401);
});
test('consumer mode with only a demo cookie cannot access event or generic paid session',async()=>{
  const cookie=await issue();let calls=0;
  const deps={env,query:rows,provider:async()=>{calls++;return{}},resolveConsumer:async()=>null};
  for(const body of [{...chatBody,mode:'consumer'}, {...chatBody,mode:'consumer',eventId:'733'}]) assert.equal((await handleSommelierChat(req('/sommelier/chat',body,{cookie}),deps)).status,403);
  assert.equal(calls,0);
});
test('consumer general context and event context are server supplied; no caller facts are accepted',async()=>{
  let forwarded;
  const context={source:'general_guidance',tenantId:'consumer-general',demo:false,facts:[]};
  const response=await handleSommelierChat(req('/sommelier/chat',{...chatBody,mode:'consumer'}),{env,query:rows,resolveConsumer:async()=>({consumerId:'10000000-0000-4000-8000-000000000001',context}),provider:async(input,ctx)=>{forwarded=ctx;return{ok:true,answer:'General',source:'fallback',fallback:true}}});
  assert.equal(response.status,200);assert.deepEqual(forwarded.facts,[]);assert.equal(forwarded.demo,false);
});
test('malformed/oversize bodies and query identities are rejected before auth/provider',async()=>{
  const deps={env,query:async()=>{throw Error('must not query')}};
  assert.equal((await handleSommelierChat(req('/sommelier/chat?event=733',chatBody),deps)).status,400);
  assert.equal((await handleSommelierChat(req('/sommelier/chat',{...chatBody,question:'x'.repeat(13000)}),deps)).status,413);
  const malformed=new Request('https://api.nexid.lat/sommelier/chat',{method:'POST',headers,body:'{'});
  assert.equal((await handleSommelierChat(malformed,deps)).status,400);
});
