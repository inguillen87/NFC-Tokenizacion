import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {CRM_ORDER_REQUEST_SOURCE_BASE,CRM_ORDER_REQUEST_REVIEWED_SOURCES,CRM_ORDER_REQUEST_ADDED,crmOrderRequestPublishedSourceHash,crmOrderRequestPriorInventory,assertCrmOrderRequestAddedSource} from './helpers/crm-order-request-reviewed-sources.mjs';
import {readHistoricalBaseline,TENANT_SYNC_REVIEWED_SOURCES,tenantSyncHistoricalSourceHash,sourceHash} from './helpers/tenant-sync-reviewed-sources.mjs';
import {ENGAGEMENT_GOVERNANCE_ADDED} from './helpers/engagement-governance-reviewed-sources.mjs';
import {TENANT_MARKETPLACE_ADDED} from './helpers/tenant-marketplace-reviewed-sources.mjs';
import {REWARD_NOTICE_ADDED} from './helpers/reward-notice-reviewed-sources.mjs';
const baseline=readHistoricalBaseline('release-convergence',await readFile(new URL('./fixtures/release-convergence-baseline.json',import.meta.url),'utf8'));
const paths=["apps/dashboard/src/lib/customer-signal-timeline.ts", "apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx", "apps/dashboard/src/components/customer-inbox.module.css", "apps/dashboard/src/lib/customer-inbox-copy.ts", "apps/dashboard/src/components/data-table.tsx"];
const addedPath="apps/dashboard/src/lib/customer-order-request-projection.ts";
const prior=[...Object.keys(baseline.expected),...Object.keys(ENGAGEMENT_GOVERNANCE_ADDED),...Object.keys(TENANT_MARKETPLACE_ADDED),...Object.keys(REWARD_NOTICE_ADDED)];
const actual=[...prior,addedPath];

test('CRM overlay contains exactly five reviewed changes and one addition on published 952',()=>{
 assert.equal(CRM_ORDER_REQUEST_SOURCE_BASE,'95260fb2e8ac1549482fefe11519e6a84fb2b6fe');
 assert.deepEqual(Object.keys(CRM_ORDER_REQUEST_REVIEWED_SOURCES).sort(),[...paths].sort());
 assert.deepEqual(Object.keys(CRM_ORDER_REQUEST_ADDED),[addedPath]);
});

test('each CRM successor returns the independent immutable origin for the prior fence chain',()=>{
 for(const [path,pins]of Object.entries(CRM_ORDER_REQUEST_REVIEWED_SOURCES)){
  assert.equal(baseline.expected[path],pins.origin);
  assert.equal(crmOrderRequestPublishedSourceHash(path,pins.after,baseline.expected[path]),pins.origin);
 }
});

test('old source, arbitrary changes and changed historical origins cannot masquerade as reviewed CRM',()=>{
 for(const [path,pins]of Object.entries(CRM_ORDER_REQUEST_REVIEWED_SOURCES)){
  assert.throws(()=>crmOrderRequestPublishedSourceHash(path,pins.origin,pins.origin),/exact reviewed CRM/);
  assert.throws(()=>crmOrderRequestPublishedSourceHash(path,sourceHash('unreviewed mutation'),pins.origin),/exact reviewed CRM/);
  assert.throws(()=>crmOrderRequestPublishedSourceHash(path,pins.after,sourceHash('wrong origin')),/independently pinned/);
 }
});

test('unreviewed and prototype-named paths stay unchanged for their original fences',()=>{
 const changed=sourceHash('unreviewed mutation'),path='apps/dashboard/src/app/sign-in/[[...sign-in]]/page.tsx';
 assert.equal(crmOrderRequestPublishedSourceHash(path,changed,baseline.expected[path]),changed);
 assert.throws(()=>tenantSyncHistoricalSourceHash(path,crmOrderRequestPublishedSourceHash(path,changed,baseline.expected[path]),TENANT_SYNC_REVIEWED_SOURCES[path].before),/exact reviewed increment/);
 for(const path of ['__proto__','constructor','toString','apps/dashboard/src/unreviewed-addition.ts'])assert.equal(crmOrderRequestPublishedSourceHash(path,changed,undefined),changed);
});

test('the inventory removes only the exact new helper and retains the entire prior inventory',()=>{
 assert.deepEqual(crmOrderRequestPriorInventory(actual,baseline.expected),prior);
 assert.equal(Object.keys(baseline.expected).length,507);
});

test('missing, duplicate, swapped and arbitrary new source paths still fail the original inventory',()=>{
 for(const inventory of [prior,[...actual,addedPath],[...actual,'apps/dashboard/src/unreviewed-addition.ts'],[...actual,'__proto__'],actual.filter(path=>path!==paths[0]),actual.map(path=>path===addedPath?'apps/dashboard/src/not-the-reviewed-helper.ts':path)])assert.throws(()=>crmOrderRequestPriorInventory(inventory,baseline.expected));
 const changedOrigin={...baseline.expected,[paths[0]]:sourceHash('wrong origin')};
 assert.throws(()=>crmOrderRequestPriorInventory(actual,changedOrigin),/immutable historical origin/);
});

test('new helper hash admission is exact and rejects arbitrary paths and prototype keys',()=>{
 const pinned=CRM_ORDER_REQUEST_ADDED[addedPath];
 assertCrmOrderRequestAddedSource(addedPath,pinned);
 assert.throws(()=>assertCrmOrderRequestAddedSource(addedPath,sourceHash('unreviewed helper')),/exact reviewed CRM/);
 for(const path of ['__proto__','constructor','toString','apps/dashboard/src/unreviewed-addition.ts'])assert.throws(()=>assertCrmOrderRequestAddedSource(path,pinned),/known CRM/);
});

test('the current reviewed helper bytes match their independent canonical source pin',async()=>{
 assertCrmOrderRequestAddedSource(addedPath,sourceHash(await readFile(new URL('../'+addedPath.replace(/^apps\/dashboard\//,''),import.meta.url),'utf8')));
});
