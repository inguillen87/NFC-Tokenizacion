import assert from 'node:assert/strict';
import test from 'node:test';
import { requestLiveSommelier, sommelierProviderBody, sommelierReservedCost, SOMMELIER_HF_MODEL, SOMMELIER_OPENAI_MODEL } from '../src/lib/sommelier-provider.ts';
import { valleSecretoSommelierFacts } from '../src/lib/sommelier-demo-facts.ts';
const env={NEXID_SOMMELIER_ENABLED:'true',HF_TOKEN:'synthetic-hf-not-a-real-key',OPENAI_API_KEY:'synthetic-openai-not-a-real-key'};
const input={mode:'demo',locale:'es-AR',question:'Un regalo para quien disfruta tintos',history:[{role:'user',content:'Es un regalo'}]};
const context=valleSecretoSommelierFacts('es-AR');
const receipt=(model=SOMMELIER_HF_MODEL,overrides={})=>Response.json({model,usage:{prompt_tokens:1200,completion_tokens:150,total_tokens:1350},choices:[{finish_reason:'stop',message:{content:JSON.stringify({advice:'Contame si la persona prefiere un vino suave o con más cuerpo.',selectedFactIds:['wine'],suggestedQuestions:['¿Qué comida va a acompañar?']})}}],...overrides});
test('valid provider receipt gives honest live provenance with pinned model/facts/history/locale',async()=>{
  const calls=[];let reserved=0;
  const response=await requestLiveSommelier(input,context,env,{reserve:async(tenant,cost)=>{assert.equal(tenant,'demo:valle-secreto');assert.ok(cost>0);reserved++;return{ok:true}},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});assert.equal(options.redirect,'error');return receipt()}});
  assert.equal(response.source,'live');assert.equal(response.fallback,false);assert.equal(response.demo,true);assert.equal(response.model,SOMMELIER_HF_MODEL);assert.equal(reserved,1);assert.equal(calls.length,1);
  assert.match(calls[0].url,/^https:\/\/router\.huggingface\.co\//);assert.equal(calls[0].body.max_tokens,1024);assert.equal(calls[0].body.reasoning_effort,'low');assert.equal(calls[0].body.response_format.json_schema.strict,true);assert.match(calls[0].body.messages[0].content,/Spanish \(Argentina\)/);assert.match(calls[0].body.messages[1].content,/untrustedHistory/);
});
test('disabled, unconfigured and denied-budget paths spend nothing',async()=>{
  let fetches=0;
  const deps={fetch:async()=>{fetches++;throw Error('must not fetch')},reserve:async()=>({ok:false,reason:'sommelier_budget_exhausted',retryAfter:10})};
  assert.equal((await requestLiveSommelier(input,context,{...env,NEXID_SOMMELIER_ENABLED:'false'},deps)).reason,'sommelier_disabled');
  assert.equal((await requestLiveSommelier(input,context,{NEXID_SOMMELIER_ENABLED:'true'},deps)).reason,'sommelier_provider_not_configured');
  assert.equal((await requestLiveSommelier(input,context,env,deps)).reason,'sommelier_budget_exhausted');assert.equal(fetches,0);
});
test('OpenAI fallback is off by default and every enabled attempt has its own reservation',async()=>{
  let calls=0,reservations=0;
  const deps={reserve:async()=>{reservations++;return{ok:true}},fetch:async(url,options)=>{calls++;if(url.includes('huggingface'))return new Response('private provider error',{status:503});const body=JSON.parse(options.body);assert.equal(body.model,SOMMELIER_OPENAI_MODEL);assert.equal(body.reasoning_effort,'none');assert.equal(body.store,false);return receipt(SOMMELIER_OPENAI_MODEL)}};
  assert.equal((await requestLiveSommelier(input,context,env,deps)).source,'fallback');assert.equal(calls,1);assert.equal(reservations,1);
  calls=reservations=0;
  assert.equal((await requestLiveSommelier(input,context,{...env,NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'},deps)).provider,'openai');assert.equal(calls,2);assert.equal(reservations,2);
});
for(const bad of [{choices:[]},{model:'unapproved-model'}, {usage:null}, {usage:{prompt_tokens:1200,completion_tokens:1025,total_tokens:2225}}, {usage:{prompt_tokens:1200,completion_tokens:150,total_tokens:1}}, {choices:[{finish_reason:'length',message:{content:'{}'}}]}, {choices:[{finish_reason:'stop',message:{content:'invalid'}}]}, {choices:[{finish_reason:'stop',message:{content:JSON.stringify({advice:'See https://evil.test',selectedFactIds:[],suggestedQuestions:[]})}}]}, {choices:[{finish_reason:'stop',message:{content:JSON.stringify({advice:'Good',selectedFactIds:['invented'],suggestedQuestions:[]})}}]}]) test('invalid provider receipt produces no false live answer '+JSON.stringify(bad).slice(0,45),async()=>{
  const response=await requestLiveSommelier(input,context,env,{reserve:async()=>({ok:true}),fetch:async()=>receipt(SOMMELIER_HF_MODEL,bad)});assert.equal(response.fallback,true);assert.equal(response.provider,undefined);
});
test('deadline covers delayed response body, cancels it and never accepts late output',async()=>{
  let cancelled=0;
  const stream=new ReadableStream({start(){},cancel(){cancelled++}});
  const response=await requestLiveSommelier(input,context,env,{deadlineMs:20,reserve:async()=>({ok:true}),fetch:async()=>new Response(stream,{headers:{'content-type':'application/json'}})});
  assert.equal(response.fallback,true);assert.equal(response.reason,'sommelier_provider_timeout');assert.ok(cancelled>=1);
});
test('a transport ignoring AbortSignal cannot keep the caller waiting or start a late fallback',async()=>{
  let fetches=0,reservations=0;
  const response=await requestLiveSommelier(input,context,{...env,NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'},{deadlineMs:15,reserve:async()=>{reservations++;return{ok:true}},fetch:async()=>{fetches++;await new Promise(r=>setTimeout(r,40));return receipt()}});
  assert.equal(response.reason,'sommelier_provider_timeout');await new Promise(r=>setTimeout(r,50));assert.equal(fetches,1);assert.equal(reservations,1);
});
test('body cap rejects oversized provider receipts without echoing them',async()=>{
  const result=await requestLiveSommelier(input,context,env,{reserve:async()=>({ok:true}),fetch:async()=>Response.json({privateError:'x'.repeat(17000)})});assert.equal(result.source,'fallback');assert.doesNotMatch(JSON.stringify(result),/privateError|xxxxx/);
});
for(const status of [401,402,403]) test(`HF ${status} opens only a five-minute warm cooldown and reserves every OpenAI attempt`,async()=>{
  const config={...env,HF_TOKEN:'synthetic-circuit-status-'+status,NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  const sequence=[];
  const deps={nowMs:()=>1000,reserve:async()=>{sequence.push('reserve');return{ok:true}},fetch:async(url)=>{sequence.push(url.includes('huggingface')?'hf':'openai');return url.includes('huggingface')?new Response('private rejection body',{status}):receipt(SOMMELIER_OPENAI_MODEL)}};
  const first=await requestLiveSommelier(input,context,config,deps);
  assert.equal(first.provider,'openai');assert.deepEqual(sequence,['reserve','hf','reserve','openai']);
  sequence.length=0;
  const warm=await requestLiveSommelier(input,context,config,deps);
  assert.equal(warm.provider,'openai');assert.deepEqual(sequence,['reserve','openai']);
  assert.doesNotMatch(JSON.stringify([first,warm]),/synthetic-circuit|private rejection/);
});
test('HF cooldown expires at five minutes and a different key retries immediately',async()=>{
  let time=1000;
  const calls=[],config={...env,HF_TOKEN:'synthetic-circuit-expiry',NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  let reject=true;
  const deps={nowMs:()=>time,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');return url.includes('huggingface')?(reject?new Response(null,{status:402}):receipt()):receipt(SOMMELIER_OPENAI_MODEL)}};
  assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'openai');
  reject=false;calls.length=0;time=300999;
  assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'openai');assert.deepEqual(calls,['openai']);
  calls.length=0;
  assert.equal((await requestLiveSommelier(input,context,{...config,HF_TOKEN:'synthetic-circuit-changed-key'},deps)).provider,'huggingface');assert.deepEqual(calls,['hf']);
  calls.length=0;time=301000;
  assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'huggingface');assert.deepEqual(calls,['hf']);
});
test('HF cooldown never skips primary when fallback flag or fallback key is absent',async()=>{
  const calls=[],config={...env,HF_TOKEN:'synthetic-circuit-fallback-gate',NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  let reject=true;
  const deps={nowMs:()=>1000,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');return url.includes('huggingface')?(reject?new Response(null,{status:403}):receipt()):receipt(SOMMELIER_OPENAI_MODEL)}};
  assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'openai');
  reject=false;
  for(const disabled of [{...config,NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'false'},{...config,OPENAI_API_KEY:''}]){calls.length=0;assert.equal((await requestLiveSommelier(input,context,disabled,deps)).provider,'huggingface');assert.deepEqual(calls,['hf'])}
});
test('warm HF cooldown cannot bypass a denied fallback reservation',async()=>{
  const config={...env,HF_TOKEN:'synthetic-circuit-budget',NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  assert.equal((await requestLiveSommelier(input,context,config,{nowMs:()=>1000,reserve:async()=>({ok:true}),fetch:async(url)=>url.includes('huggingface')?new Response(null,{status:401}):receipt(SOMMELIER_OPENAI_MODEL)})).provider,'openai');
  let fetches=0,reservations=0;
  const denied=await requestLiveSommelier(input,context,config,{nowMs:()=>1001,reserve:async()=>{reservations++;return{ok:false,reason:'sommelier_budget_exhausted',retryAfter:2}},fetch:async()=>{fetches++;return receipt()}});
  assert.equal(denied.reason,'sommelier_budget_exhausted');assert.equal(reservations,1);assert.equal(fetches,0);
});
for(const status of [404,429,500,503]) test(`HF ${status} never opens the authentication/payment cooldown`,async()=>{
  const calls=[],config={...env,HF_TOKEN:'synthetic-circuit-not-cached-'+status,NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  const deps={nowMs:()=>1000,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');return url.includes('huggingface')?new Response(null,{status}):receipt(SOMMELIER_OPENAI_MODEL)}};
  for(let i=0;i<2;i++) assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'openai');
  assert.deepEqual(calls,['hf','openai','hf','openai']);
});
test('HF transport exceptions never open the cooldown',async()=>{
  const calls=[],config={...env,HF_TOKEN:'synthetic-circuit-network-error',NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  const deps={nowMs:()=>1000,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');if(url.includes('huggingface'))throw new TypeError('private transport failure');return receipt(SOMMELIER_OPENAI_MODEL)}};
  for(let i=0;i<2;i++) assert.equal((await requestLiveSommelier(input,context,config,deps)).provider,'openai');
  assert.deepEqual(calls,['hf','openai','hf','openai']);
});
test('HF rejection arriving after deadline cannot open a cooldown or start a late fallback',async()=>{
  const config={...env,HF_TOKEN:'synthetic-circuit-late-rejection',NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED:'true'};
  const calls=[];
  const delayed=await requestLiveSommelier(input,context,config,{nowMs:()=>1000,deadlineMs:10,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');await new Promise(resolve=>setTimeout(resolve,25));return new Response(null,{status:402})}});
  assert.equal(delayed.reason,'sommelier_provider_timeout');
  await new Promise(resolve=>setTimeout(resolve,35));assert.deepEqual(calls,['hf']);
  calls.length=0;
  assert.equal((await requestLiveSommelier(input,context,config,{nowMs:()=>1001,reserve:async()=>({ok:true}),fetch:async(url)=>{calls.push(url.includes('huggingface')?'hf':'openai');return receipt()}})).provider,'huggingface');
  assert.deepEqual(calls,['hf']);
});

test('cost reservation counts full UTF8 request bytes and all 1024 output tokens',()=>{
  for(const provider of ['huggingface','openai']){const body=JSON.stringify(sommelierProviderBody(provider,input,context));assert.ok(sommelierReservedCost(provider,body)>0);assert.ok(sommelierReservedCost(provider,body+'水')>=sommelierReservedCost(provider,body));}
});
