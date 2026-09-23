import assert from 'node:assert/strict';
import test from 'node:test';
import {rollManifestCall,RollManifestError,ROLL_RESPONSE_MAX_BYTES,rollManifestErrorCopy} from '../src/lib/roll-manifest-client.ts';
const csv='uid,batch_id\n04000000000001,QA-ROLL-01\n04000000000002,QA-ROLL-01';
const input={bid:'QA-ROLL-01',csv,dryRun:true,activateImported:false};
const payload={ok:true,batch:input.bid,dryRun:true,activated:false,importedRows:2,inserted:2,duplicateUids:[]};
const response=(body=payload,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
test('only the existing command is sent without activation or caller-supplied scope',async()=>{
 let recorded;const receipt=await rollManifestCall({...input,tenant:'not-forwarded'},async(path,options)=>{recorded={path,options};return response();});
 assert.equal(receipt.rows,2);assert.equal(recorded.path,'/api/admin/batches/QA-ROLL-01/import-manifest');
 assert.deepEqual(JSON.parse(recorded.options.body),{csv,dryRun:true,activateImported:false});assert.equal(recorded.options.credentials,'same-origin');assert.equal(recorded.options.cache,'no-store');
});
for(const patch of [{csv:''},{bid:''},{activateImported:true},{csv:'uid,k_meta\n04,placeholder'}])test('invalid command remains local '+JSON.stringify(patch),async()=>{let calls=0;await assert.rejects(rollManifestCall({...input,...patch},async()=>{calls++;return response();}),RollManifestError);assert.equal(calls,0);});
for(const dryRun of [true,false]){
 for(const status of [400,401,403,404,409,413,422,429])test(`structured rejection ${status}, dryRun=${dryRun}`,async()=>{await assert.rejects(rollManifestCall({...input,dryRun},async()=>response({ok:false,reason:'internal-diagnostic'},status)),e=>e instanceof RollManifestError&&!e.uncertain&&!rollManifestErrorCopy(e).includes('internal-diagnostic'));});
 for(const status of [408,500,502,503])test(`ambiguous response ${status}, dryRun=${dryRun}`,async()=>{await assert.rejects(rollManifestCall({...input,dryRun},async()=>response({ok:false},status)),e=>e.uncertain===!dryRun);});
 test(`malformed success cannot be accepted, dryRun=${dryRun}`,async()=>{await assert.rejects(rollManifestCall({...input,dryRun},async()=>response('<html>not a receipt</html>')),e=>e.code==='invalid_receipt'&&e.uncertain===!dryRun);});
 test(`transport failure classification, dryRun=${dryRun}`,async()=>{await assert.rejects(rollManifestCall({...input,dryRun},async()=>{throw Error('network failure');}),e=>e.code==='unavailable'&&e.uncertain===!dryRun);});
}
test('oversized content-length cancels the response before reading it',async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(rollManifestCall({...input,dryRun:false},async()=>new Response(body,{headers:{'content-length':String(ROLL_RESPONSE_MAX_BYTES+1)}})),e=>e.uncertain);assert.equal(cancelled,true);
});
test('stream limit also applies without content-length',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(ROLL_RESPONSE_MAX_BYTES));c.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
 await assert.rejects(rollManifestCall(input,async()=>new Response(body)),e=>e.code==='invalid_receipt');assert.equal(cancelled,true);
});
test('explicit demo transport cannot authorize an import',async()=>{await assert.rejects(rollManifestCall(input,async()=>response(payload,200,{'x-nexid-data-mode':'demo'})),e=>e.code==='invalid_receipt');});
test('legacy import without dryRun remains compatible',async()=>{const {dryRun,...commit}=payload;const result=await rollManifestCall({...input,dryRun:false},async()=>response(commit));assert.equal(result.dryRun,false);});
test('caller cancellation is forwarded without automatic retry',async()=>{
 const controller=new AbortController();let calls=0;
 const running=rollManifestCall({...input,dryRun:false,signal:controller.signal},async(path,options)=>{calls++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));});
 controller.abort();await assert.rejects(running,e=>e.uncertain);assert.equal(calls,1);
});
