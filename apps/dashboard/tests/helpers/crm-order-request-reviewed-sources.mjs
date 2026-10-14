import assert from 'node:assert/strict';
import {rewardNoticePriorInventory} from './reward-notice-reviewed-sources.mjs';

// Exact successor offered for review on published 952; all prior fixtures and overlays stay intact.
export const CRM_ORDER_REQUEST_SOURCE_BASE='95260fb2e8ac1549482fefe11519e6a84fb2b6fe';
export const CRM_ORDER_REQUEST_REVIEWED_SOURCES=Object.freeze({
 "apps/dashboard/src/lib/customer-signal-timeline.ts":Object.freeze({origin:"9b93173fd5f975ede99c7f6c3c2b7860aa67c37ef41881be8437829ffb4f84f7",after:"65b98647c5ccdd670bf4b3dc3e087eddd0d04fbc9a1eab0f3b227562fc0dc5f5"}),
 "apps/dashboard/src/app/(app)/leads-tickets/leads-tickets-client.tsx":Object.freeze({origin:"8ba56352e0d8990c6bd67542ff85611c9c9123bc9f51868ea3d1133668f3f286",after:"ccc9792a81cdf0b02a6e4b3ff97bf974d9b912be49f6b48b56e012813d2be594"}),
 "apps/dashboard/src/components/customer-inbox.module.css":Object.freeze({origin:"b17f057e2fcf65d6d2207a52c5e04163c230aacbb511f3421ee85395c6e374b2",after:"1a9f0788a23a0bc6cce296a423b71835ea1c669160370f8d9cf18a94171a8668"}),
 "apps/dashboard/src/lib/customer-inbox-copy.ts":Object.freeze({origin:"76b799147969a48012ce8f90501e3ccaa119a23e2424130a710c30fadd69fa78",after:"72c613d421d3d46ce31494f6dd89b4ac14cf646a05371e29497d055cfa1c32ea"}),
 "apps/dashboard/src/components/data-table.tsx":Object.freeze({origin:"71caa11de0c9f8b3795eed0f3b202a4de7b37f8e991d5d3273c58322e44ddc94",after:"3977c062764432b362e2ed91af95a9b4d4fafaa21980bf10a901bf82b91f7385"})
});
export const CRM_ORDER_REQUEST_ADDED=Object.freeze({
 "apps/dashboard/src/lib/customer-order-request-projection.ts":"966c3ec811cb477a084a4a7a3187bd49703e2ce51dc99b36e6d76912833491dd"
});

export function crmOrderRequestPublishedSourceHash(path,actual,expectedOrigin){
 if(!Object.hasOwn(CRM_ORDER_REQUEST_REVIEWED_SOURCES,path))return actual;
 const reviewed=CRM_ORDER_REQUEST_REVIEWED_SOURCES[path];
 assert.equal(expectedOrigin,reviewed.origin,path+' independently pinned published 952 origin');
 assert.equal(actual,reviewed.after,path+' exact reviewed CRM request successor');
 return reviewed.origin;
}

export function crmOrderRequestPriorInventory(actual,historicalExpected){
 for(const path of Object.keys(CRM_ORDER_REQUEST_REVIEWED_SOURCES)){
  assert.ok(Object.hasOwn(historicalExpected,path),'known changed CRM origin '+path);
  assert.equal(historicalExpected[path],CRM_ORDER_REQUEST_REVIEWED_SOURCES[path].origin,path+' immutable historical origin');
 }
 for(const path of Object.keys(CRM_ORDER_REQUEST_ADDED)){
  assert.ok(!Object.hasOwn(historicalExpected,path),'explicitly new CRM source '+path);
  assert.equal(actual.filter(value=>value===path).length,1,path+' exactly one new CRM source');
 }
 const prior=actual.filter(path=>!Object.hasOwn(CRM_ORDER_REQUEST_ADDED,path));
 // This original gate still checks every historical path and every prior addition.
 rewardNoticePriorInventory(prior,historicalExpected);
 return prior;
}

export function assertCrmOrderRequestAddedSource(path,actual){
 assert.ok(Object.hasOwn(CRM_ORDER_REQUEST_ADDED,path),'known CRM request source addition');
 assert.equal(actual,CRM_ORDER_REQUEST_ADDED[path],path+' exact reviewed CRM source addition');
}
