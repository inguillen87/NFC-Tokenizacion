import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {TICKET_STATUS_SYNC_SOURCE_BASE,TICKET_STATUS_SYNC_REVIEWED_SOURCES,TICKET_STATUS_SYNC_ADDED,ticketStatusSyncPublishedSourceHash,ticketStatusSyncPriorInventory,assertTicketStatusSyncAddedSource} from './helpers/ticket-status-sync-reviewed-sources.mjs';
import {PHYSICAL_TAP_REVIEWED_SOURCES,physicalTapPublishedSourceHash} from './helpers/physical-tap-reviewed-sources.mjs';
import {crmOrderRequestPublishedSourceHash,crmOrderRequestPriorInventory} from './helpers/crm-order-request-reviewed-sources.mjs';
import {readHistoricalBaseline,sourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';

const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
const changedPaths=[
 'apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx',
 'apps/dashboard/src/components/ticket-reference-lookup.tsx',
 'apps/dashboard/src/components/ticket-workflow.tsx',
 'apps/dashboard/src/lib/ticket-workflow-copy.ts',
];
const addedPath='apps/dashboard/src/lib/ticket-status-reconciliation.ts';
const runtime=[];
async function walk(dir,prefix='apps/dashboard/src'){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())await walk(new URL(entry.name+'/',dir),prefix+'/'+entry.name);else if(entry.isFile())runtime.push(prefix+'/'+entry.name);}}
await walk(new URL('../src/',import.meta.url));

test('ticket-status successor admits exactly four changed sources and one helper on published e3',()=>{
 assert.equal(TICKET_STATUS_SYNC_SOURCE_BASE,'e3f14a0bcd4aace7cf66b7944d59427a16497bc4');
 assert.deepEqual(Object.keys(TICKET_STATUS_SYNC_REVIEWED_SOURCES).sort(),[...changedPaths].sort());
 assert.deepEqual(Object.keys(TICKET_STATUS_SYNC_ADDED),[addedPath]);
 assert.ok(Object.isFrozen(TICKET_STATUS_SYNC_REVIEWED_SOURCES));
 assert.ok(Object.isFrozen(TICKET_STATUS_SYNC_ADDED));
 for(const pins of Object.values(TICKET_STATUS_SYNC_REVIEWED_SOURCES))assert.ok(Object.isFrozen(pins));
});

test('each actual successor traverses its independently retained prior and complete old physical/CRM chain',async()=>{
 for(const [path,pins]of Object.entries(TICKET_STATUS_SYNC_REVIEWED_SOURCES)){
  const actual=sourceHash(await readFile(new URL('../'+path.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8'));
  assert.equal(actual,pins.after,path);
  assert.equal(baseline.expected[path],pins.historical,path+' unchanged historical pin');
  const prior=ticketStatusSyncPublishedSourceHash(path,actual,baseline.expected[path]);
  assert.equal(prior,pins.origin,path+' exact published e3 prior');
  const afterPhysical=physicalTapPublishedSourceHash(path,prior,baseline.expected[path]);
  assert.equal(crmOrderRequestPublishedSourceHash(path,afterPhysical,baseline.expected[path]),baseline.expected[path]);
 }
 const parent=changedPaths[0];
 assert.equal(TICKET_STATUS_SYNC_REVIEWED_SOURCES[parent].origin,PHYSICAL_TAP_REVIEWED_SOURCES[parent].after);
 assert.equal(Object.hasOwn(baseline.expected,addedPath),false);
 assertTicketStatusSyncAddedSource(addedPath,sourceHash(await readFile(new URL('../'+addedPath.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8')));
});

test('old sources, arbitrary mutation, altered historical origins and swapped path hashes are rejected',()=>{
 for(const [path,pins]of Object.entries(TICKET_STATUS_SYNC_REVIEWED_SOURCES)){
  assert.throws(()=>ticketStatusSyncPublishedSourceHash(path,pins.origin,baseline.expected[path]),/exact reviewed ticket-status successor/);
  assert.throws(()=>ticketStatusSyncPublishedSourceHash(path,sourceHash('unreviewed change'),baseline.expected[path]),/exact reviewed ticket-status successor/);
  assert.throws(()=>ticketStatusSyncPublishedSourceHash(path,pins.after,sourceHash('changed historical origin')),/independently pinned historical origin/);
  for(const [otherPath,otherPins]of Object.entries(TICKET_STATUS_SYNC_REVIEWED_SOURCES)){
   if(otherPath!==path)assert.throws(()=>ticketStatusSyncPublishedSourceHash(path,otherPins.after,baseline.expected[path]),/exact reviewed ticket-status successor/);
  }
 }
});

test('only the exact single added helper is removed before the complete historical inventory checks',()=>{
 const prior=ticketStatusSyncPriorInventory(runtime,baseline.expected);
 assert.deepEqual(prior,runtime.filter(path=>path!==addedPath));
 assert.deepEqual(crmOrderRequestPriorInventory(prior,baseline.expected),crmOrderRequestPriorInventory(runtime.filter(path=>path!==addedPath),baseline.expected));
 const historicalPath=Object.keys(baseline.expected)[0];
 for(const inventory of [
  runtime.filter(path=>path!==historicalPath),
  [...runtime,historicalPath],
  [...runtime,'apps/dashboard/src/unreviewed-runtime-addition.ts'],
  runtime.filter(path=>path!==addedPath),
  [...runtime,addedPath],
 ])assert.throws(()=>ticketStatusSyncPriorInventory(inventory,baseline.expected));
 assert.throws(()=>ticketStatusSyncPriorInventory(runtime,{...baseline.expected,[changedPaths[0]]:'0'.repeat(64)}));
 assert.throws(()=>ticketStatusSyncPriorInventory(runtime,{...baseline.expected,[addedPath]:'0'.repeat(64)}));
});

test('the added-source check rejects unknown paths, swapped successor hashes and arbitrary helper changes',()=>{
 assert.throws(()=>assertTicketStatusSyncAddedSource('apps/dashboard/src/unreviewed-runtime-addition.ts','0'.repeat(64)),/known ticket-status source addition/);
 assert.throws(()=>assertTicketStatusSyncAddedSource(addedPath,sourceHash('unreviewed helper')),/exact reviewed ticket-status addition/);
 for(const pins of Object.values(TICKET_STATUS_SYNC_REVIEWED_SOURCES))assert.throws(()=>assertTicketStatusSyncAddedSource(addedPath,pins.after),/exact reviewed ticket-status addition/);
});

test('unreviewed and prototype-named paths cannot be remapped into historical source pins',()=>{
 const arbitrary=sourceHash('unreviewed source');
 for(const path of ['__proto__','constructor','toString','apps/dashboard/src/lib/permission-policy.ts','apps/dashboard/src/unreviewed-runtime-addition.ts']){
  for(const value of [arbitrary,null,undefined,...Object.values(TICKET_STATUS_SYNC_REVIEWED_SOURCES).map(pins=>pins.after)]){
   assert.equal(ticketStatusSyncPublishedSourceHash(path,value,undefined),value);
  }
 }
});
