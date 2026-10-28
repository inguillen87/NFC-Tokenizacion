import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_CONFIRMATION_BASE,CATALOG_CONFIRMATION_CHANGED,catalogConfirmationPriorHash} from './helpers/catalog-confirmation-reviewed-sources.mjs';
import {CRM_FILTER_CONTEXT_CHANGED,crmFilterContextPriorHash} from './helpers/crm-filter-context-reviewed-sources.mjs';
import {CUSTOMER_FEEDBACK_CHANGED,customerFeedbackPriorHash} from './helpers/customer-feedback-reviewed-sources.mjs';

// Canonical c372 Git-blob bytes and the independently retained 60d origins.
const publishedBefore={
 'apps/dashboard/src/components/tenant-marketplace-workspace.tsx':'e9f13ecae3aefe8f1ac93d56e749140bd94c9ff7e4bc7126c80fbda72f310152',
 'apps/dashboard/src/components/tenant-marketplace-workspace.module.css':'dec82d79091efd682236a6a34decb44490d144957856341dbfbe93b130c19d2c',
};
const feedbackOrigins={
 'apps/dashboard/src/components/tenant-marketplace-workspace.tsx':'267e33fecb730b2449d73887ea1090a77b1db102e39010620908e1963109bcdb',
 'apps/dashboard/src/components/tenant-marketplace-workspace.module.css':'4b732c4bc1473f4f562f578ceaf33cfaecdc266a4b9722031724668736298e71',
};
const hash=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
const readSource=name=>readFile(new URL('../'+name.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8');

test('catalog confirmation overlay pins only two exact c372 origins without rewriting historical overlays',()=>{
 assert.equal(CATALOG_CONFIRMATION_BASE,'c372b3bed96a405834dac075060790b8b0a31329');
 assert.deepEqual(Object.keys(CATALOG_CONFIRMATION_CHANGED).sort(),Object.keys(publishedBefore).sort());
 assert(Object.isFrozen(CATALOG_CONFIRMATION_CHANGED));
 for(const [name,pin]of Object.entries(CATALOG_CONFIRMATION_CHANGED)){
  assert(Object.isFrozen(pin));assert.deepEqual(Object.keys(pin).sort(),['after','before']);
  assert.equal(pin.before,publishedBefore[name]);assert.match(pin.after,/^[a-f0-9]{64}$/);assert.notEqual(pin.after,pin.before);
  assert.deepEqual(CUSTOMER_FEEDBACK_CHANGED[name],{before:feedbackOrigins[name],after:publishedBefore[name]});
  assert.equal(Object.hasOwn(CRM_FILTER_CONTEXT_CHANGED,name),false,'c372 catalogue sources are not silently relabeled as CRM filter changes');
 }
});

for(const [name,pin]of Object.entries(CATALOG_CONFIRMATION_CHANGED)){
 test('catalog confirmation accepts only reviewed successor bytes and retains its prior chain: '+name,async()=>{
  const text=await readSource(name),actual=hash(text);
  assert.equal(actual,pin.after,'the current real source has the independently reviewed successor hash');
  const c372=catalogConfirmationPriorHash(name,actual);assert.equal(c372,publishedBefore[name]);
  const crm=crmFilterContextPriorHash(name,c372);assert.equal(crm,publishedBefore[name]);
  assert.equal(customerFeedbackPriorHash(name,crm),feedbackOrigins[name]);
  for(const wrong of [pin.before,'0'.repeat(64),'',undefined,null,hash(text+'\n// Unreviewed source-byte mutation\n')]){
   assert.throws(()=>catalogConfirmationPriorHash(name,wrong),/exact reviewed catalog confirmation increment/);
  }
  for(const [other,otherPin]of Object.entries(CATALOG_CONFIRMATION_CHANGED))if(other!==name){
   assert.throws(()=>catalogConfirmationPriorHash(name,otherPin.after),/exact reviewed catalog confirmation increment/,'a different reviewed file cannot impersonate this source');
  }
  assert.throws(()=>customerFeedbackPriorHash(name,actual),/exact reviewed customer feedback increment/,'the successor cannot skip its new exact overlay');
 });
}

test('unknown and prototype-named sources pass through without becoming a reviewed catalogue origin',()=>{
 const unreviewed=hash('unreviewed source bytes');
 for(const name of ['__proto__','constructor','toString','apps/dashboard/src/future-unreviewed.ts','apps/dashboard/src/components/Tenant-marketplace-workspace.tsx']){
  for(const value of [unreviewed,'',undefined,null])assert.equal(catalogConfirmationPriorHash(name,value),value);
  for(const pin of Object.values(CATALOG_CONFIRMATION_CHANGED)){
   assert.equal(catalogConfirmationPriorHash(name,pin.after),pin.after);assert.notEqual(catalogConfirmationPriorHash(name,pin.after),pin.before);
  }
  assert.throws(()=>assert.equal(catalogConfirmationPriorHash(name,unreviewed),'historical-origin'));
 }
});
