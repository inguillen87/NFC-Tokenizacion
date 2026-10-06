import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {getPublishedCustomerConfiguration} from '../src/lib/published-customer-configuration.ts';
const tenantId=randomUUID(),programId=randomUUID();
function fixture({settings,program,catalog=false,duplicate=false,failedCatalog=false}={}){
  const calls=[];return {calls,overrides:{readTrivia:async(eventId,p)=>{assert.equal(eventId,'42');assert.equal(p.tenant_id,tenantId);return null},query:async(strings,...values)=>{
    const s=strings.join('?');calls.push({s,values});
    if(s.includes('FROM events'))return Array.from({length:duplicate?2:1},()=>({tenant_id:tenantId,tenant_slug:'canonical-qa',metadata:{postTap:settings,privateSecret:'synthetic-hidden'}}));
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
  for(const eventId of ['0','-1','42; SELECT 1','9007199254740992'])await assert.rejects(getPublishedCustomerConfiguration(eventId,f.overrides),/invalid/);assert.equal(f.calls.length,1);
});
