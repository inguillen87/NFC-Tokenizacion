import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {CRM_FILTER_CONTEXT_BASE,CRM_FILTER_CONTEXT_CHANGED,crmFilterContextPriorHash} from './helpers/crm-filter-context-reviewed-sources.mjs';
import {customerFeedbackPriorHash,customerFeedbackPriorInventory,CUSTOMER_FEEDBACK_CHANGED} from './helpers/customer-feedback-reviewed-sources.mjs';
import {ticketStatusSyncPublishedSourceHash,ticketStatusSyncPriorInventory} from './helpers/ticket-status-sync-reviewed-sources.mjs';
import {physicalTapPublishedSourceHash} from './helpers/physical-tap-reviewed-sources.mjs';
import {crmOrderRequestPublishedSourceHash,CRM_ORDER_REQUEST_REVIEWED_SOURCES} from './helpers/crm-order-request-reviewed-sources.mjs';
import {readHistoricalBaseline,sourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';

// Independently derived canonical Git blobs at d1bd; never replace historical fixture expectations.
const publishedBefore={
 'apps/dashboard/src/components/data-table.tsx':'6d0f150d8cb7ea0d8df507080341e3887f2036fca105dc7094dfa99654e44fa8',
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx':'44c6a8c0a731d8f4f66a985b7b6f11f605c66d593042abec3a766d1d5d4f22b5',
 'apps/dashboard/src/lib/customer-inbox-copy.ts':'72c613d421d3d46ce31494f6dd89b4ac14cf646a05371e29497d055cfa1c32ea',
};
const readSource=name=>readFile(new URL('../'+name.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8');
const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));

test('CRM filter overlay contains exactly three frozen d1bd origins with no inventory removals',()=>{
 assert.equal(CRM_FILTER_CONTEXT_BASE,'d1bd6d8d99a535045ad3354262dacd61859e8ada');
 assert.deepEqual(Object.keys(CRM_FILTER_CONTEXT_CHANGED).sort(),Object.keys(publishedBefore).sort());
 assert.ok(Object.isFrozen(CRM_FILTER_CONTEXT_CHANGED));
 for(const[name,pin]of Object.entries(CRM_FILTER_CONTEXT_CHANGED)){
  assert.ok(Object.isFrozen(pin));assert.deepEqual(Object.keys(pin).sort(),['after','before']);
  assert.equal(pin.before,publishedBefore[name],name+' independently derived d1bd origin');
  assert.match(pin.after,/^[a-f0-9]{64}$/);assert.notEqual(pin.after,pin.before);
 }
});

for(const[name,pin]of Object.entries(CRM_FILTER_CONTEXT_CHANGED)){
 test('only current reviewed CRM filter bytes map to their exact prior: '+name,async()=>{
  const actual=sourceHash(await readSource(name));assert.equal(actual,pin.after);
  assert.equal(crmFilterContextPriorHash(name,actual),publishedBefore[name]);
  for(const wrong of[pin.before,'0'.repeat(64),'',undefined,null]){
   assert.throws(()=>crmFilterContextPriorHash(name,wrong),/exact reviewed CRM filter increment/);
  }
  for(const[other,otherPin]of Object.entries(CRM_FILTER_CONTEXT_CHANGED))if(other!==name){
   assert.throws(()=>crmFilterContextPriorHash(name,otherPin.after),/exact reviewed CRM filter increment/);
  }
 });
}

test('the new successor composes with every unchanged older guard before reaching the historical origin',async()=>{
 for(const[name,pin]of Object.entries(CRM_FILTER_CONTEXT_CHANGED)){
  const current=sourceHash(await readSource(name));
  const d1bd=crmFilterContextPriorHash(name,current);assert.equal(d1bd,publishedBefore[name]);
  if(Object.hasOwn(CUSTOMER_FEEDBACK_CHANGED,name))assert.equal(d1bd,CUSTOMER_FEEDBACK_CHANGED[name].after);
  else assert.equal(d1bd,CRM_ORDER_REQUEST_REVIEWED_SOURCES[name].after);
  const prior=customerFeedbackPriorHash(name,d1bd);
  const ticketPrior=ticketStatusSyncPublishedSourceHash(name,prior,baseline.expected[name]);
  const physicalPrior=physicalTapPublishedSourceHash(name,ticketPrior,baseline.expected[name]);
  assert.equal(crmOrderRequestPublishedSourceHash(name,physicalPrior,baseline.expected[name]),baseline.expected[name]);
  assert.throws(()=>crmFilterContextPriorHash(name,pin.before),/exact reviewed CRM filter increment/,'an old source is not silently accepted as a new candidate');
 }
});

test('unknown and prototype-named sources pass through and cannot impersonate a reviewed historical source',()=>{
 const unknown=sourceHash('unreviewed source');
 for(const name of['__proto__','constructor','toString','apps/dashboard/src/lib/future-unreviewed.ts']){
  for(const value of[unknown,'',undefined,null])assert.equal(crmFilterContextPriorHash(name,value),value);
  for(const pin of Object.values(CRM_FILTER_CONTEXT_CHANGED)){
   assert.equal(crmFilterContextPriorHash(name,pin.after),pin.after);assert.notEqual(crmFilterContextPriorHash(name,pin.after),pin.before);
  }
  assert.throws(()=>assert.equal(crmFilterContextPriorHash(name,unknown),'historical-origin'));
 }
});

test('the complete unchanged inventory still rejects missing, duplicate and unknown runtime paths',async()=>{
 const current=[];
 async function walk(dir,prefix='apps/dashboard/src'){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   if(entry.isDirectory())await walk(new URL(entry.name+'/',dir),prefix+'/'+entry.name);
   else if(entry.isFile())current.push(prefix+'/'+entry.name);
  }
 }
 await walk(new URL('../src/',import.meta.url));const original=[...current];
 const verify=paths=>ticketStatusSyncPriorInventory(customerFeedbackPriorInventory(paths),baseline.expected);
 verify(current);assert.deepEqual(current,original,'no inventory mutation or new runtime addition is hidden');
 const historical=Object.keys(baseline.expected)[0];
 assert.throws(()=>verify(current.filter(name=>name!==historical)));
 for(const name of Object.keys(CRM_FILTER_CONTEXT_CHANGED))assert.throws(()=>verify(current.filter(value=>value!==name)));
 for(const name of[historical,...Object.keys(CRM_FILTER_CONTEXT_CHANGED)])assert.throws(()=>verify([...current,name]));
 assert.throws(()=>verify([...current,'apps/dashboard/src/future-unreviewed.ts']));
});
