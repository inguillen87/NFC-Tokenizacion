import test from 'node:test';import assert from 'node:assert/strict';
import {readEditorialQueue,EditorialQueueReadError} from '../src/lib/editorial-queue-read.ts';
import {normalizeQueueFilters,queueFiltersFromSearch} from '../src/lib/editorial-queue.ts';
import {queueFixture,filters} from './editorial-queue-continuity-fixture.mjs';
const input={tenant:'company',filters},reply=data=>Response.json(data,{headers:{'x-nexid-data-mode':'production'}});
for(const patch of [{state:'unknown'},{view:'admin'},{q:'x'.repeat(101)},{q:'line\nbreak'},{state:['draft']},{q:3},{view:{toString:()=> 'all'}},{actor:'spoof'}])test('invalid filters rejected before transport '+JSON.stringify(patch),async()=>{let calls=0;await assert.rejects(readEditorialQueue({...input,filters:{...filters,...patch}},async()=>{calls++;return reply(queueFixture());}),e=>e.code==='invalid');assert.equal(calls,0);});
for(const query of [{state:['draft','approved']},{view:['all']},{q:['secret']},{tenant:['a','b']},{cursor:'internal'},{actor:'spoof'}])test('shared URL does not ignore duplicate or unexpected selectors '+JSON.stringify(query),()=>assert.throws(()=>queueFiltersFromSearch(query)));
test('filters normalize whitespace without changing state or scope',()=>assert.deepEqual(normalizeQueueFilters({...filters,q:'  Producto  '}),{...filters,q:'Producto'}));
for(const status of [401,403,404,409,400,503])test('HTTP '+status+' settles without consuming a stalled body',async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(readEditorialQueue(input,async()=>new Response(body,{status})),e=>e instanceof EditorialQueueReadError&&e.code===([401,403,404].includes(status)?'forbidden':status===409?'position_changed':status===400?'invalid':'unavailable'));
 assert.equal(cancelled,true);
});
test('query includes only tenant filters and cursor and never a write',async()=>{
 const data=await readEditorialQueue({...input,cursor:'page_2',page:2},async(path,init)=>{assert.equal(path,'/api/admin/passport-editorial/queue?tenant=company&cursor=page_2');assert.equal(init.method,'GET');assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.body,undefined);return reply(queueFixture('company',filters,2));});assert.equal(data.navigation.page,2);
});
for(const mode of ['missing-header','demo-header','demo-body','foreign','wrong-page','html','invalid-utf8','oversized','redirected'])test('source boundary rejects '+mode,async()=>{
 const data=queueFixture();if(mode==='demo-body')data.demo=true;if(mode==='foreign')data.scope.tenant='other';if(mode==='wrong-page')data.navigation.page=2;
 const response=mode==='html'?new Response('<html>provider detail</html>',{headers:{'content-type':'text/html','x-nexid-data-mode':'production'}}):mode==='invalid-utf8'?new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}}):reply(data);
 if(mode==='missing-header')response.headers.delete('x-nexid-data-mode');if(mode==='demo-header')response.headers.set('x-nexid-data-mode','demo');if(mode==='oversized')response.headers.set('content-length','262145');if(mode==='redirected')Object.defineProperty(response,'redirected',{value:true});
 await assert.rejects(readEditorialQueue(input,async()=>response),e=>e.code==='invalid');
});
for(const phase of ['headers','body'])test('one deadline bounds a noncooperative '+phase,async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});const started=Date.now();
 await assert.rejects(readEditorialQueue({...input,timeoutMs:20},async()=>phase==='headers'?new Promise(()=>{}):new Response(body,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.code==='timeout');
 assert.ok(Date.now()-started<500);if(phase==='body')assert.equal(cancelled,true);
});
test('cancellation before request causes no transport call',async()=>{let calls=0;const c=new AbortController();c.abort();await assert.rejects(readEditorialQueue({...input,signal:c.signal},async()=>{calls++;return reply(queueFixture());}),e=>e.code==='cancelled');assert.equal(calls,0);});
test('explicit cancellation releases an uncooperative fetch',async()=>{const c=new AbortController();const request=readEditorialQueue({...input,signal:c.signal},async()=>new Promise(()=>{}));c.abort();await assert.rejects(request,e=>e.code==='cancelled');});
test('late response after timeout is cancelled rather than parsed',async()=>{let release,cancelled=false;const pending=new Promise(r=>release=r);const task=readEditorialQueue({...input,timeoutMs:10},async()=>pending);await assert.rejects(task,e=>e.code==='timeout');release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}}));await new Promise(r=>setTimeout(r,10));assert.equal(cancelled,true);});
test('chunked oversized body is stopped without trusting content length',async()=>{let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(262145));},cancel(){cancelled=true;}});await assert.rejects(readEditorialQueue(input,async()=>new Response(stream,{headers:{'content-type':'application/json','x-nexid-data-mode':'production'}})),e=>e.code==='invalid');assert.equal(cancelled,true);});
for(const patch of [{tenant:'../other'},{page:0},{cursor:'bad&selector'},{cursor:'page_2',page:1},{page:2},{timeoutMs:12001}])test('invalid binding causes zero requests '+JSON.stringify(patch),async()=>{let calls=0;await assert.rejects(readEditorialQueue({...input,...patch},async()=>{calls++;return reply(queueFixture());}),e=>e.code==='invalid');assert.equal(calls,0);});
