import test from 'node:test';
import assert from 'node:assert/strict';
import { requestConsumerJson } from '../src/lib/consumer-request.ts';

async function withFetch(fake, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('consumer requests preserve HTTP denial even when the body claims success', async () => {
  await withFetch(async () => new Response('{"ok":true,"authenticated":true}', {status:503}), async () => {
    const result = await requestConsumerJson('/api/consumer/session');
    assert.equal(result.status,'received'); assert.equal(result.ok,false); assert.equal(result.httpStatus,503);
  });
});

test('malformed or empty acknowledgements remain unknown', async () => {
  for (const value of ['', 'not json', '[]', 'null', 'false']) await withFetch(async () => new Response(value), async () => {
    const result = await requestConsumerJson('/api/consumer/auth/verify', {method:'POST'});
    assert.equal(result.status,'received'); assert.equal(result.payload,null);
  });
});

test('consumer request deadline aborts exactly once without retrying a mutation', async () => {
  let calls=0;
  await withFetch((_url,options) => new Promise((_resolve,reject) => {
    calls++; options.signal.addEventListener('abort',()=>reject(new Error('aborted')), {once:true});
  }), async () => {
    const result=await requestConsumerJson('/api/consumer/auth/start',{method:'POST',body:'synthetic'},15);
    assert.deepEqual(result,{status:'unavailable',reason:'timeout'}); assert.equal(calls,1);
  });
});

test('connection failures keep server details out of client feedback and do not retry', async () => {
  let calls=0;
  await withFetch(async () => {calls++;throw Error('private upstream details');},async()=>{
    assert.deepEqual(await requestConsumerJson('/api/consumer/auth/start'),{status:'unavailable',reason:'connection'});assert.equal(calls,1);
  });
});

test('deadline includes a response body that never finishes', async () => {
  await withFetch(async (_url,options)=>({ok:true,status:200,json:()=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))}),async()=>{
    assert.deepEqual(await requestConsumerJson('/api/consumer/session',{},15),{status:'unavailable',reason:'timeout'});
  });
});
