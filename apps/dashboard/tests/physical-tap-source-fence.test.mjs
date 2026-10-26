import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PHYSICAL_TAP_SOURCE_BASE,PHYSICAL_TAP_REVIEWED_SOURCES,physicalTapPublishedSourceHash} from './helpers/physical-tap-reviewed-sources.mjs';
import {CRM_ORDER_REQUEST_REVIEWED_SOURCES,crmOrderRequestPublishedSourceHash} from './helpers/crm-order-request-reviewed-sources.mjs';
import {readHistoricalBaseline,sourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';
import {ticketStatusSyncPublishedSourceHash} from './helpers/ticket-status-sync-reviewed-sources.mjs';
import {customerFeedbackPriorHash} from './helpers/customer-feedback-reviewed-sources.mjs';

const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
const paths=[
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx',
 'apps/dashboard/src/components/customer-member-timeline.tsx',
 'apps/dashboard/src/components/physical-taps-command-center.tsx',
];

test('physical TAP overlay allows exactly three reviewed runtime paths on published 3e25',()=>{
 assert.equal(PHYSICAL_TAP_SOURCE_BASE,'3e25d60ac2de10faeeab11e2ae6fec56926bc9ea');
 assert.deepEqual(Object.keys(PHYSICAL_TAP_REVIEWED_SOURCES).sort(),[...paths].sort());
 assert.ok(Object.isFrozen(PHYSICAL_TAP_REVIEWED_SOURCES));
 for(const pins of Object.values(PHYSICAL_TAP_REVIEWED_SOURCES))assert.ok(Object.isFrozen(pins));
});

test('the three current sources match exact reviewed pins and return their independent prior origins',async()=>{
 for(const [path,pins]of Object.entries(PHYSICAL_TAP_REVIEWED_SOURCES)){
  const rawActual=sourceHash(await readFile(new URL('../'+path.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8'));
  const actual=ticketStatusSyncPublishedSourceHash(path,customerFeedbackPriorHash(path,rawActual),baseline.expected[path]);
  assert.equal(actual,pins.after,path);
  assert.equal(physicalTapPublishedSourceHash(path,actual,baseline.expected[path]),pins.origin);
  assert.equal(crmOrderRequestPublishedSourceHash(path,physicalTapPublishedSourceHash(path,actual,baseline.expected[path]),baseline.expected[path]),baseline.expected[path]);
 }
});

test('old sources, arbitrary mutations, changed origins and swapped path hashes are never admitted',()=>{
 for(const [path,pins]of Object.entries(PHYSICAL_TAP_REVIEWED_SOURCES)){
  assert.throws(()=>physicalTapPublishedSourceHash(path,pins.origin,baseline.expected[path]),/exact reviewed physical TAP/);
  assert.throws(()=>physicalTapPublishedSourceHash(path,sourceHash('unreviewed change'),baseline.expected[path]),/exact reviewed physical TAP/);
  assert.throws(()=>physicalTapPublishedSourceHash(path,pins.after,sourceHash('changed historical origin')),/independently pinned/);
  for(const [otherPath,otherPins]of Object.entries(PHYSICAL_TAP_REVIEWED_SOURCES)){
   if(otherPath!==path)assert.throws(()=>physicalTapPublishedSourceHash(path,otherPins.after,baseline.expected[path]),/exact reviewed physical TAP/);
  }
 }
});

test('the CRM successor returns to its old published pin before the immutable CRM origin guard runs',()=>{
 const path=paths[0],old=CRM_ORDER_REQUEST_REVIEWED_SOURCES[path],pins=PHYSICAL_TAP_REVIEWED_SOURCES[path];
 assert.equal(pins.origin,old.after);
 assert.equal(baseline.expected[path],old.origin);
 assert.throws(()=>crmOrderRequestPublishedSourceHash(path,pins.after,baseline.expected[path]),/exact reviewed CRM/);
 assert.equal(crmOrderRequestPublishedSourceHash(path,physicalTapPublishedSourceHash(path,pins.after,baseline.expected[path]),baseline.expected[path]),old.origin);
});

test('other inputs and prototype-named paths pass through unchanged and cannot be remapped to a historical pin',()=>{
 const arbitrary=sourceHash('unreviewed source');
 for(const path of ['__proto__','constructor','toString','apps/dashboard/src/lib/permission-policy.ts','apps/dashboard/src/unreviewed-addition.ts']){
  assert.equal(physicalTapPublishedSourceHash(path,arbitrary,undefined),arbitrary);
  assert.equal(physicalTapPublishedSourceHash(path,null,undefined),null);
  assert.equal(physicalTapPublishedSourceHash(path,undefined,undefined),undefined);
  for(const pins of Object.values(PHYSICAL_TAP_REVIEWED_SOURCES)){
   assert.equal(physicalTapPublishedSourceHash(path,pins.after,undefined),pins.after);
   assert.notEqual(physicalTapPublishedSourceHash(path,pins.after,undefined),pins.origin);
  }
 }
});
