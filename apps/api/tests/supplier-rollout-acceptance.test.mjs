import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {SUPPLIER_ROLLOUT_SWITCHES,withSupplierWriteSwitches} from '../scripts/lib/supplier-rollout-acceptance.mjs';
const keys=SUPPLIER_ROLLOUT_SWITCHES.map(([,key])=>key);
test('acceptance switch catalog is fixed to the four approved modules',()=>{
 assert.equal(keys.length,4);assert.equal(new Set(keys).size,4);
 assert.ok(Object.isFrozen(SUPPLIER_ROLLOUT_SWITCHES)&&SUPPLIER_ROLLOUT_SWITCHES.every(Object.isFrozen));
 assert.deepEqual(SUPPLIER_ROLLOUT_SWITCHES.map(x=>x[0]),['cancellation','quotation','supplier-binding','delivery-ack']);
});
for(const name of ['NODE_ENV','VERCEL_ENV'])for(const value of ['production','preview','development',''])test(name+'='+JSON.stringify(value)+' rejects test switching before changes',async()=>{
 const env={NODE_ENV:'test',VERCEL_ENV:'test',[name]:value,[keys[0]]:'original'};const before={...env};let called=false;
 await assert.rejects(withSupplierWriteSwitches('true',async()=>{called=true;},env));
 assert.deepEqual(env,before);assert.equal(called,false);
});
for(const value of ['TRUE','1',true,null,undefined])test('invalid switch value '+JSON.stringify(value)+' is refused',async()=>{
 const env={NODE_ENV:'test',VERCEL_ENV:'test'};let called=false;
 await assert.rejects(withSupplierWriteSwitches(value,async()=>{called=true;},env));
 assert.equal(called,false);assert.deepEqual(env,{NODE_ENV:'test',VERCEL_ENV:'test'});
});
for(const target of ['true','false'])test('temporary '+target+' restores present, missing and unusual original values',async()=>{
 const env={NODE_ENV:'test',VERCEL_ENV:'test',[keys[0]]:'false',[keys[1]]:'true',[keys[2]]:'unexpected'};const before={...env};
 assert.equal(await withSupplierWriteSwitches(target,async()=>{await Promise.resolve();for(const key of keys)assert.equal(env[key],target);return 'done';},env),'done');
 assert.deepEqual(env,before);assert.equal(Object.hasOwn(env,keys[3]),false);
});
test('a failed HTTP assertion restores every original test-process value',async()=>{
 const env={NODE_ENV:'test',VERCEL_ENV:'test',[keys[0]]:'false'};const before={...env};
 await assert.rejects(withSupplierWriteSwitches('true',async()=>{await Promise.resolve();throw Error('synthetic route failed');},env),/synthetic route failed/);
 assert.deepEqual(env,before);
});
test('nested phase restores the surrounding phase before restoring its caller',async()=>{
 const env={NODE_ENV:'test',VERCEL_ENV:'test'};
 await withSupplierWriteSwitches('true',async()=>{
  await withSupplierWriteSwitches('false',async()=>{for(const k of keys)assert.equal(env[k],'false');},env);
  for(const k of keys)assert.equal(env[k],'true');
 },env);
 for(const k of keys)assert.equal(Object.hasOwn(env,k),false);
});
test('the real handler chain includes all correction and switch probes without external effects',async()=>{
 const source=await readFile(new URL('../scripts/lib/supplier-chain-acceptance.mjs',import.meta.url),'utf8');
 for(const name of ['verifySupplierClosedRollout','verifySupplierCancellation','verifyQuotationCorrections','verifyBindingCorrections','verifyAckCorrections'])assert.ok(source.includes('await '+name),name);
 assert.match(source,/SUPPLIER_REQUEST_CANCELLATION_ENABLED/);
 assert.match(source,/graph\.acknowledgements===4&&graph\.quotations===6/);
 for(const name of ['supplier-rollout-acceptance','supplier-rollout-cancellation','supplier-rollout-transitions']){
  const text=await readFile(new URL('../scripts/lib/'+name+'.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(text,/https:\/\/|api\.vercel|neon\.tech|writeFile|console\.log|CREATE (?:OR REPLACE )?FUNCTION/);
 }
});
